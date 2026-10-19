const fs = require('fs');
let content = fs.readFileSync('grow.html', 'utf8');

const broken = `    } catch (e) {
      console.log('paintLive error:', e && e.message ? e.message : e);
    }
  }
    badge.classList.toggle('boost',boosted);
    var boostBtn=document.getElementById('boost-btn');
    var claimBtn=document.getElementById('claim-btn');
    var fill=document.getElementById('boost-fill');
    var txt=document.getElementById('boost-text');
    if(!mining){
      if(lastBtnSec!==-3){lastBtnSec=-3;txt.textContent='Watch ad · start mining';}
      fill.style.width='0%';
      boostBtn.disabled=false;boostBtn.removeAttribute('aria-disabled');boostBtn.removeAttribute('aria-label');
      if(claimBtn){claimBtn.disabled=false;claimBtn.removeAttribute('aria-disabled');claimBtn.removeAttribute('title');}
    }
    else if(boosted){
      var left=state.boostUntilMs-now;
      var pct=Math.min(100,Math.max(0,left/INVEST_BOOST_MS*100));
      var sec=Math.ceil(left/1000);
      if(sec!==lastBtnSec){lastBtnSec=sec;txt.textContent='Boosted · '+fmtClock(left)+' left';boostBtn.setAttribute('aria-label','Boost active, '+fmtClock(left)+' remaining');}
      fill.style.width=pct+'%';
      boostBtn.disabled=true;boostBtn.setAttribute('aria-disabled','true');
      if(claimBtn){claimBtn.disabled=true;claimBtn.setAttribute('aria-disabled','true');claimBtn.title='Claim unlocks when the boost ends';}
    }else{
      if(lastBtnSec!==-2){lastBtnSec=-2;txt.textContent='Watch ad · boost 1 hour';}
      fill.style.width='0%';
      boostBtn.disabled=false;boostBtn.removeAttribute('aria-disabled');boostBtn.removeAttribute('aria-label');
      if(claimBtn){claimBtn.disabled=false;claimBtn.removeAttribute('aria-disabled');claimBtn.removeAttribute('title');}
    }
    document.getElementById('s-apr').textContent=(boosted?'15,000%':(mining?'10,000%':'—'));
    var hint=document.getElementById('boost-hint');
    if(hint)hint.textContent=!mining?'One ad starts a full 6h mining shift.':(boosted?'Boost draining — claim unlocks when the timer ends.':'One ad lights a full hour at 15,000%.');
  }
  function paintBadges(n){`;

const fixed = `    } catch (e) {
      console.log('paintLive error:', e && e.message ? e.message : e);
    }
    var badge=document.getElementById('apr-badge');
    document.getElementById('apr-text').textContent=(boosted?'15,000% BOOSTED':(mining?'10,000% APR':'PAUSED'));
    badge.classList.toggle('boost',boosted);
    var boostBtn=document.getElementById('boost-btn');
    var claimBtn=document.getElementById('claim-btn');
    var fill=document.getElementById('boost-fill');
    var txt=document.getElementById('boost-text');
    if(!mining){
      if(lastBtnSec!==-3){lastBtnSec=-3;txt.textContent='Watch ad · start mining';}
      fill.style.width='0%';
      boostBtn.disabled=false;boostBtn.removeAttribute('aria-disabled');boostBtn.removeAttribute('aria-label');
      if(claimBtn){claimBtn.disabled=false;claimBtn.removeAttribute('aria-disabled');claimBtn.removeAttribute('title');}
    }
    else if(boosted){
      var left=state.boostUntilMs-now;
      var pct=Math.min(100,Math.max(0,left/INVEST_BOOST_MS*100));
      var sec=Math.ceil(left/1000);
      if(sec!==lastBtnSec){lastBtnSec=sec;txt.textContent='Boosted · '+fmtClock(left)+' left';boostBtn.setAttribute('aria-label','Boost active, '+fmtClock(left)+' remaining');}
      fill.style.width=pct+'%';
      boostBtn.disabled=true;boostBtn.setAttribute('aria-disabled','true');
      if(claimBtn){claimBtn.disabled=true;claimBtn.setAttribute('aria-disabled','true');claimBtn.title='Claim unlocks when the boost ends';}
    }else{
      if(lastBtnSec!==-2){lastBtnSec=-2;txt.textContent='Watch ad · boost 1 hour';}
      fill.style.width='0%';
      boostBtn.disabled=false;boostBtn.removeAttribute('aria-disabled');boostBtn.removeAttribute('aria-label');
      if(claimBtn){claimBtn.disabled=false;claimBtn.removeAttribute('aria-disabled');claimBtn.removeAttribute('title');}
    }
    document.getElementById('s-apr').textContent=(boosted?'15,000%':(mining?'10,000%':'—'));
    var hint=document.getElementById('boost-hint');
    if(hint)hint.textContent=!mining?'One ad starts a full 6h mining shift.':(boosted?'Boost draining — claim unlocks when the timer ends.':'One ad lights a full hour at 15,000%.');
  }
  function paintBadges(n){`;

if (content.includes(broken)) {
  content = content.replace(broken, fixed);
  fs.writeFileSync('grow.html', content, 'utf8');
  console.log('Fixed!');
} else {
  console.log('Pattern not found');
  const lines = content.split('\n');
  for (let i = 354; i < 392 && i < lines.length; i++) {
    console.log((i+1) + ': ' + JSON.stringify(lines[i]));
  }
}
