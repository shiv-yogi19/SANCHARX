# Browser tests (Playwright/Chromium). External hosts are mocked via page.route ONLY inside this test script.
import json, sys, threading, http.server, socketserver, functools, os
from playwright.sync_api import sync_playwright
ROOT = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..')
class Q(http.server.SimpleHTTPRequestHandler):
    def log_message(self, *a, **k): pass
H = functools.partial(Q, directory=ROOT)
srv = socketserver.TCPServer(('127.0.0.1', 0), H); port = srv.server_address[1]
threading.Thread(target=srv.serve_forever, daemon=True).start()
URL = f'http://127.0.0.1:{port}/index.html'
res = []; 
def ok(c, m, extra=''):
    res.append(c); print(('PASS ' if c else 'FAIL ') + m + (' :: ' + str(extra) if (extra and not c) else ''))

CORS = {'access-control-allow-origin': '*'}
def mock(route):
    u = route.request.url
    if 'speed.cloudflare.com/__down' in u:
        import re; n = int(re.search(r'bytes=(\d+)', u).group(1)); n = min(n, 300000)
        import time
        if n > 0: time.sleep(0.45)  # slow mock so live 200 ms samples can occur
        route.fulfill(status=200, headers=CORS, body=b'x' * n)
    elif 'speed.cloudflare.com/__up' in u: route.fulfill(status=200, headers=CORS, body='ok')
    elif 'ipify.org' in u: route.fulfill(status=200, headers={**CORS, 'content-type': 'application/json'}, body='{"ip":"203.0.113.77"}')
    elif 'cloudflare-dns.com' in u or 'dns.google' in u: route.fulfill(status=200, headers={**CORS, 'content-type': 'application/dns-json'}, body='{"Status":0,"Answer":[{"name":"example.com.","type":1,"TTL":30,"data":"93.184.216.34"}]}')
    elif u.startswith('http://127.0.0.1'): route.continue_()
    else: route.fulfill(status=200, headers=CORS, body='')

def overflow(page): return page.evaluate('document.documentElement.scrollWidth - document.documentElement.clientWidth')

with sync_playwright() as p:
    b = p.chromium.launch()
    for name, vp, mobile in [('desktop', {'width': 1280, 'height': 800}, False), ('mobile', {'width': 390, 'height': 800}, True)]:
        ctx = b.new_context(viewport=vp, is_mobile=mobile, has_touch=mobile, locale='en-US')
        page = ctx.new_page(); errors = []
        page.on('console', lambda m: errors.append(m.text) if m.type == 'error' else None)
        page.on('pageerror', lambda e: errors.append(str(e)))
        page.route('**/*', mock)
        page.goto(URL); page.wait_for_timeout(300)
        ok(page.is_visible('#intro'), f'[{name}] intro shown on first entry')
        ok('Created By Shiv Yogi' in page.inner_text('#intro'), f'[{name}] intro has Created By Shiv Yogi')
        page.click('#intro-skip'); page.wait_for_timeout(800)
        ok(not page.is_visible('#intro'), f'[{name}] intro dismissed')
        ok(page.is_visible('#btn-start'), f'[{name}] Start Test visible')
        ok(overflow(page) <= 0, f'[{name}] no horizontal overflow on Home', overflow(page))
        page.screenshot(path=f'/tmp/sx_{name}_home.png')
        # nav items
        navsel = '.topnav a' if not mobile else '.bottomnav a'
        ok(page.is_visible('.bottomnav') == mobile, f'[{name}] bottom nav visible only on mobile')
        for v in ['tools', 'reports', 'ai', 'home']:
            page.click(f'{navsel}[data-nav="{v}"]'); page.wait_for_timeout(250)
            ok(page.is_visible(f'#view-{v}') and page.get_attribute(f'{navsel}[data-nav="{v}"]', 'aria-current') == 'page', f'[{name}] nav -> {v} opens and is marked active')
            ok(overflow(page) <= 0, f'[{name}] no overflow on {v}', overflow(page))
        # back navigation
        page.click(f'{navsel}[data-nav="tools"]'); page.click(f'{navsel}[data-nav="ai"]'); page.go_back(); page.wait_for_timeout(200)
        ok(page.is_visible('#view-tools'), f'[{name}] browser back returns to previous section')
        page.click(f'{navsel}[data-nav="home"]'); page.wait_for_timeout(200)
        # Speed test run (mocked endpoints)
        page.click('#btn-start')
        page.wait_for_selector('#btn-cancel:not([hidden])', timeout=3000)
        ok(page.is_visible('#btn-cancel') and not page.is_visible('#btn-start'), f'[{name}] Cancel shown while running')
        page.wait_for_function("document.getElementById('state-text').textContent === 'Completed'", timeout=60000)
        d = page.inner_text('#m-down [data-val]'); u = page.inner_text('#m-up [data-val]'); l = page.inner_text('#m-lat [data-val]')
        ok(d != '—' and u != '—' and l != '—', f'[{name}] test completes with values (mocked endpoint)', (d, u, l))
        ok('Not measured' in page.inner_text('#m-loss'), f'[{name}] packet loss honestly shown as not measured')
        ok(page.get_attribute('#g-dl', 'points') not in (None, ''), f'[{name}] graph drawn from samples')
        ok(page.inner_text('#btn-start') == 'Test Again', f'[{name}] button becomes Test Again')
        page.click('#btn-save'); page.wait_for_timeout(300)
        ok(page.is_disabled('#btn-save') and page.inner_text('#btn-save') == 'Saved', f'[{name}] save to history works')
        # cancel flow
        page.click('#btn-start'); page.wait_for_selector('#btn-cancel:not([hidden])'); page.click('#btn-cancel'); page.wait_for_timeout(400)
        ok(page.inner_text('#state-text') == 'Cancelled' and page.is_visible('#error-box'), f'[{name}] cancel gives Cancelled state')
        # second completed test for history compare
        page.click('#btn-start'); page.wait_for_function("document.getElementById('state-text').textContent === 'Completed'", timeout=60000)
        page.click('#btn-save'); page.wait_for_timeout(200)
        # Tools
        page.goto(URL + '#tools/subnet'); page.wait_for_timeout(300)
        page.fill('#sn-ip', '192.168.1.10'); page.fill('#sn-mask', '/26'); page.wait_for_timeout(100)
        t = page.inner_text('#sn-table'); ok('192.168.1.0' in t and '192.168.1.63' in t and '62' in t, f'[{name}] subnet tool correct', t[:80])
        page.fill('#sn-ip', '300.1.1.1'); ok(page.is_visible('#sn-err'), f'[{name}] subnet shows validation error')
        page.click('#tab-calc'); page.fill('#c1-val', '80'); ok('10.000 MB/s' in page.inner_text('#c1-out'), f'[{name}] calculator converts')
        page.fill('#c1-val', '-4'); ok('Negative' in page.inner_text('#c1-out'), f'[{name}] calculator rejects negatives')
        page.click('#tab-dns'); page.fill('#dns-domain', 'example.com'); page.click('#dns-go'); page.wait_for_selector('#dns-out table'); ok('93.184.216.34' in page.inner_text('#dns-out') and 'Cloudflare' in page.inner_text('#dns-out'), f'[{name}] DNS result + resolver named')
        page.fill('#dns-domain', 'not a domain'); page.click('#dns-go'); page.wait_for_timeout(100); ok(page.is_visible('#dns-out .notice'), f'[{name}] DNS invalid domain error')
        page.click('#tab-ip'); page.click('#ip-go'); page.wait_for_selector('#ip-out strong'); ok(page.inner_text('#ip-out strong') == '203.0.113.77' and 'ipify.org' in page.inner_text('#ip-out'), f'[{name}] public IP + provider shown')
        page.click('#tab-endpoint'); page.fill('#ep-url', 'javascript:alert(1)'); page.click('#ep-go'); ok(page.is_visible('#ep-err'), f'[{name}] endpoint blocks javascript: URL')
        page.fill('#ep-url', 'https://192.168.0.1'); page.click('#ep-go'); ok(page.is_visible('#ep-err'), f'[{name}] endpoint blocks private address')
        page.fill('#ep-url', 'https://example.com'); page.click('#ep-go'); page.wait_for_function("document.querySelector('#ep-out').textContent.includes('response')", timeout=20000); ok(True, f'[{name}] endpoint check returns')
        page.click('#tab-advisor'); ok('Online gaming' in page.inner_text('#adv-out'), f'[{name}] advisor lists activities')
        page.click('#tab-troubleshoot'); ok('What your measurements show' in page.inner_text('#ts-out'), f'[{name}] troubleshooter renders')
        page.click('#tab-safety'); ok(page.locator('.safe-item').count() == 7, f'[{name}] safety guide has 7 topics')
        page.click('#tab-stability'); page.click('#stab-start'); page.wait_for_function("+document.getElementById('st-n').textContent >= 2", timeout=15000)
        page.click('#stab-stop'); n1 = page.inner_text('#st-n'); page.wait_for_timeout(1500); ok(page.inner_text('#st-n') == n1 and page.is_visible('#stab-start'), f'[{name}] stability monitor stops cleanly')
        page.click('#stab-start'); page.wait_for_timeout(500); page.goto(URL + '#home'); page.wait_for_timeout(300); page.goto(URL + '#tools/stability'); 
        # favorites
        page.click('[data-fav="dns"]') if False else None
        page.click('#tab-dns'); page.click('[data-fav="dns"]'); ok(page.is_visible('#fav-bar') and 'DNS Lookup' in page.inner_text('#fav-chips'), f'[{name}] favorite toggle adds chip')
        # tablist keyboard
        page.focus('#tab-dns'); page.keyboard.press('ArrowRight'); ok(page.get_attribute('#tab-ip', 'aria-selected') == 'true', f'[{name}] tabs keyboard arrow navigation')
        # Reports
        page.goto(URL + '#reports'); page.wait_for_timeout(400)
        ok(page.locator('.hist-item').count() == 2, f'[{name}] history lists saved tests', page.locator('.hist-item').count())
        page.locator('.hist-item input[type=checkbox]').nth(0).check(); page.locator('.hist-item input[type=checkbox]').nth(1).check()
        ok(page.locator('#hist-compare table').count() == 1, f'[{name}] compare two entries')
        rs = page.inner_text('#report-sheet')
        for need in ['SANCHARX', 'Created By Shiv Yogi', 'Download', 'Upload', 'HTTP latency', 'Jitter estimate', 'Not measured by this browser test', 'Measurement method and limitations', 'Recommendations']:
            ok(need in rs, f'[{name}] report contains "{need}"')
        ok('SHIV YOGI' in page.inner_html('#report-sheet'), f'[{name}] report has SHIV YOGI watermark')
        page.emulate_media(media='print'); page.evaluate("document.body.classList.add('printing-report')")
        vis = page.evaluate("[...document.querySelectorAll('header.topbar,.bottomnav,#view-home,#view-tools,.aurora')].every(e=>getComputedStyle(e).display==='none')")
        ok(vis and page.is_visible('#report-sheet'), f'[{name}] print layout hides navigation, shows report')
        if not mobile: page.pdf(path='/tmp/sx_report.pdf', print_background=True)
        page.evaluate("document.body.classList.remove('printing-report')"); page.emulate_media(media='screen')
        page.screenshot(path=f'/tmp/sx_{name}_reports.png')
        page.locator('.hist-item button').first.click(); page.wait_for_timeout(200); ok(page.locator('.hist-item').count() == 1, f'[{name}] delete single history entry')
        page.click('#hist-clear'); page.wait_for_selector('#dlg-confirm[open]'); page.click('#conf-ok'); page.wait_for_timeout(300); ok(page.locator('.hist-item').count() == 0, f'[{name}] clear all history with confirmation')
        # Assistant
        page.goto(URL + '#ai'); page.wait_for_selector('#chat-log .msg'); 
        ok('rule-based' in page.inner_text('#view-ai'), f'[{name}] assistant labelled rule-based')
        page.click('#chat-log .chip >> text=हिन्दी'); page.wait_for_timeout(700)
        ok(page.inner_text('#h-ai') == 'SANCHARX AI सहायक', f'[{name}] onboarding Hindi choice switches interface language')
        page.click('#chat-log .chip >> text=छोड़ें'); page.wait_for_timeout(900)
        ok(page.locator('#ai-cats .chip').count() == 6, f'[{name}] six category buttons shown')
        page.locator('#ai-cats .chip').nth(2).click(); page.wait_for_timeout(300); ok(page.locator('#ai-suggest .chip').count() == 8, f'[{name}] Speed Test category lists 8 questions', page.locator('#ai-suggest .chip').count())
        page.locator('#ai-suggest .chip').first.click(); page.wait_for_timeout(800); ok('Mbps' in page.inner_text('#chat-log'), f'[{name}] FAQ answer appears')
        page.fill('#chat-input', 'wifi slow'); page.press('#chat-input', 'Enter'); page.wait_for_timeout(900); ok('Wi-Fi' in page.inner_text('#chat-log') or 'राउटर' in page.inner_text('#chat-log'), f'[{name}] typed question matched')
        page.fill('#chat-input', 'who is the prime minister'); page.press('#chat-input', 'Enter'); page.wait_for_timeout(900); ok('50' in page.locator('#chat-log .msg.bot').last.inner_text(), f'[{name}] fallback for unsupported question')
        page.reload(); page.goto(URL + '#ai'); page.wait_for_timeout(600); ok(page.locator('#ai-cats .chip').count() == 6, f'[{name}] onboarding not repeated in same session')
        page.click('#ai-clear'); page.wait_for_timeout(700); ok(page.locator('#chat-log .msg').count() >= 1, f'[{name}] clear chat resets log')
        # language switch back + settings
        page.select_option('#lang-select', 'en'); page.wait_for_timeout(200)
        ok(page.inner_text('#h-ai') == 'SANCHARX AI Assistant', f'[{name}] EN/HI toggle (header selector)')
        page.click('#btn-settings'); page.wait_for_selector('#dlg-settings[open]'); page.select_option('#set-motion', 'reduce'); page.check('#set-autosave'); page.keyboard.press('Escape'); page.wait_for_timeout(300)
        ok(page.get_attribute('html', 'data-motion') == 'reduce', f'[{name}] reduced-motion setting applied')
        page.reload(); page.wait_for_timeout(300)
        ok(page.get_attribute('html', 'data-motion') == 'reduce' and page.evaluate("JSON.parse(localStorage.getItem('sancharx.settings')).autosave") is True, f'[{name}] settings persist after reload')
        anim = page.evaluate("getComputedStyle(document.querySelector('.aurora i')).animationDuration"); ok(anim in ('0.001s', '1e-06s'), f'[{name}] reduced motion neutralises animation', anim)
        page.screenshot(path=f'/tmp/sx_{name}_ai.png')
        ok(not errors, f'[{name}] zero console errors', errors[:3])
        ctx.close()
    # Failure / offline states with real (blocked) network: no mock
    ctx = b.new_context(viewport={'width': 390, 'height': 800}); page = ctx.new_page(); errs = []
    page.route('**/*', lambda r: r.abort() if 'cloudflare' in r.request.url else r.continue_())
    page.add_init_script("sessionStorage.setItem('sx.intro','1')")
    page.goto(URL); page.click('#btn-start'); page.wait_for_function("['Failed','Timed out','Offline'].includes(document.getElementById('state-text').textContent)", timeout=60000)
    ok(page.inner_text('#state-text') == 'Failed' and page.is_visible('#error-box'), '[failure] blocked endpoint -> honest Failed state with message', page.inner_text('#error-box'))
    ok(page.inner_text('#m-down [data-val]') == '—' and page.inner_text('#m-up [data-val]') == '—', '[failure] no fake numbers shown')
    ok(page.inner_text('#btn-start') == 'Retry', '[failure] Retry offered')
    ctx.set_offline(True); page.click('#btn-start'); page.wait_for_timeout(800); ok(page.inner_text('#state-text') == 'Offline', '[failure] offline state')
    ctx.close(); b.close()
srv.shutdown()
print(f"\n{sum(res)}/{len(res)} browser checks passed"); sys.exit(0 if all(res) else 1)
