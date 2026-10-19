'use strict';
const {chromium}=require('playwright'), http=require('http'), fs=require('fs'), path=require('path'), assert=require('assert');
(async()=>{
  const dir=path.resolve(__dirname,'../app');
  const server=http.createServer((q,r)=>{
    const f=path.join(dir,q.url==='/'?'index.html':q.url);
    if(!f.startsWith(dir+'/')){r.writeHead(403).end();return;}
    try{r.setHeader('Content-Type',f.endsWith('.js')?'text/javascript':f.endsWith('.css')?'text/css':'text/html');r.end(fs.readFileSync(f));}
    catch(e){r.writeHead(404).end();}
  });
  await new Promise(ok=>server.listen(0,'127.0.0.1',ok));let browser;
  try{
    browser=await chromium.launch({headless:true,executablePath:process.env.CHROMIUM_PATH || '/usr/bin/chromium',args:['--no-sandbox']});
    const page=await browser.newPage({viewport:{width:1920,height:1080}}), errors=[],requests=[];
    page.on('pageerror',e=>errors.push(e.message));page.on('request',r=>requests.push(r.url()));
    await page.goto('http://127.0.0.1:'+server.address().port);await page.waitForTimeout(100);
    assert((await page.locator('#model').innerText()).includes('Unavailable'));
    await page.keyboard.press('ArrowRight');assert.equal(await page.evaluate(()=>document.activeElement.id),'measure');
    await page.keyboard.press('Enter');await page.waitForTimeout(5500);
    assert((await page.locator('#timing').innerText()).includes('This page only'));
    assert(await page.evaluate(()=>document.documentElement.scrollHeight<=innerHeight));
    await page.locator('#view').click();
    assert(await page.locator('#runtime-view').isVisible());assert(await page.locator('#measure').isDisabled());
    assert((await page.locator('#useragent').innerText()).length>0);
    assert((await page.locator('#apiexplanation').innerText()).includes('not evidence of denied permission'));
    await page.locator('#refresh').click();assert(await page.locator('#measure').isDisabled());
    await page.screenshot({path:path.resolve(__dirname,'../preview-runtime.png')});
    assert(await page.evaluate(()=>document.documentElement.scrollHeight<=innerHeight));
    await page.locator('#view').click();await page.locator('#measure').click();await page.locator('#view').click();
    assert(await page.locator('#stop').isDisabled());assert(await page.locator('#measure').isDisabled());
    await page.locator('#view').click();assert((await page.locator('#timing').innerText()).includes('view changed'));
    assert.equal(errors.length,0);assert(requests.every(u=>u.startsWith('http://127.0.0.1:')));
    assert.equal(await page.evaluate(()=>localStorage.length),0);
    await page.screenshot({path:path.resolve(__dirname,'../preview.png')});
    console.log('PASS: 1080p views, remote navigation, frame test, interrupted flow, no runtime errors/external requests/storage writes');
  }finally{if(browser)await browser.close();server.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
