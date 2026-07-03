# Markup snippets — Onyx Conditioning Corner

`renderConditioning()` in `dashboard.html` builds this screen from HTML
strings — there's no static markup to paste over. Below are the exact
string-template lines to change, keeping every id/attribute the JS reads
elsewhere untouched.

## Toggle buttons — `tgBtn()` helper

Current:
```js
var tgBtn=function(id,label){return '<button onclick="setCondSubTab(\''+id+'\')" style="flex:1;padding:10px;border-radius:10px;border:none;cursor:pointer;font-family:inherit;font-size:13px;font-weight:800;letter-spacing:0.02em;'+(condSubTab===id?'background:#E24B4A;color:#fff;':'background:transparent;color:#94a3b8;')+'">'+label+'</button>';};
```

Onyx replacement — same signature, swap the active/inactive fill:
```js
var tgBtn=function(id,label){return '<button onclick="setCondSubTab(\''+id+'\')" class="cond-toggle-btn'+(condSubTab===id?' active':'')+'" style="flex:1;padding:10px;border-radius:11px;border:none;cursor:pointer;font-family:\'Archivo\',inherit;font-size:13px;font-weight:800;letter-spacing:0.02em;'+(condSubTab===id?'background:linear-gradient(135deg,#e9cb7d,#c79c4f);color:#1a1409;':'background:transparent;color:#8b8b92;')+'">'+label+'</button>';};
```

## Sub-category header

Current:
```js
html+='<div class="cond-sub"><div class="cond-sub-head">'
  +'<div class="cond-sub-icon" style="background:'+hexA(col,0.14)+';border-color:'+hexA(col,0.4)+'">'+(sub.icon||'🔥')+'</div>'
  +'<div><div class="cond-sub-name">'+esc(sub.name)+'</div>'
  +(sub.blurb?'<div class="cond-sub-blurb">'+esc(sub.blurb)+'</div>':'')+'</div></div>';
```

Onyx replacement — only the icon chip's border alpha/radius change (handled
by the CSS file's `.cond-sub-icon` rule); no JS change needed here beyond
using `hexA(col,0.14)` / `hexA(col,0.35)`:
```js
html+='<div class="cond-sub"><div class="cond-sub-head">'
  +'<div class="cond-sub-icon" style="background:'+hexA(col,0.14)+';border:1px solid '+hexA(col,0.35)+'">'+(sub.icon||'🔥')+'</div>'
  +'<div><div class="cond-sub-name">'+esc(sub.name)+'</div>'
  +(sub.blurb?'<div class="cond-sub-blurb">'+esc(sub.blurb)+'</div>':'')+'</div></div>';
```

## Routine card

Current:
```js
html+='<a href="'+r.href+'" class="cond-card" data-cond-id="'+esc(r.id)+'"'
    +' data-mc-orig-name="'+esc(r.name)+'" data-mc-orig-tag="'+esc(r.tag||'')+'" data-mc-orig-meta="'+esc(r.meta||'')+'"'
    +' style="background:linear-gradient(135deg,'+hexA(col,0.12)+','+'var(--surface));border-color:'+hexA(col,0.33)+'">'
    +'<div class="cond-arrow" style="background:'+hexA(col,0.2)+';border-color:'+hexA(col,0.33)+'">→</div>'
    +(tg?'<div class="cond-tag" style="color:'+col+'">'+esc(tg)+'</div>':'')
    +'<div class="cond-name">'+esc(nm)+'</div>'
    +(mt?'<div class="cond-meta">'+esc(mt)+'</div>':'')
    +((r.stats&&r.stats.length)?'<div class="cond-stats">'+r.stats.map(function(s){return '<span class="cond-stat">'+esc(s)+'</span>';}).join('')+'</div>':'')
    +'</a>';
```

Onyx replacement — darker card fill, borderless quiet chevron instead of the
filled circle+arrow glyph, tag tinted lighter for legibility on dark:
```js
html+='<a href="'+r.href+'" class="cond-card" data-cond-id="'+esc(r.id)+'"'
    +' data-mc-orig-name="'+esc(r.name)+'" data-mc-orig-tag="'+esc(r.tag||'')+'" data-mc-orig-meta="'+esc(r.meta||'')+'"'
    +' style="background:linear-gradient(135deg,'+hexA(col,0.1)+',rgba(20,20,22,.5));border:1px solid '+hexA(col,0.28)+'">'
    +'<svg class="cond-arrow" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#8b8b92" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M9 6l6 6-6 6"/></svg>'
    +(tg?'<div class="cond-tag" style="color:'+tintLight(col)+'">'+esc(tg)+'</div>':'')
    +'<div class="cond-name">'+esc(nm)+'</div>'
    +(mt?'<div class="cond-meta">'+esc(mt)+'</div>':'')
    +((r.stats&&r.stats.length)?'<div class="cond-stats">'+r.stats.map(function(s){return '<span class="cond-stat">'+esc(s)+'</span>';}).join('')+'</div>':'')
    +'</a>';
```

> `tintLight(col)` is a new tiny helper to lighten the accent for the tag
> text (dark backgrounds need a lighter tint than the raw `col` value reads
> fine on light `var(--surface)`). Simplest implementation — mix toward white:
> ```js
> function tintLight(hex){
>   var h=hex.replace('#',''); var r=parseInt(h.substr(0,2),16),g=parseInt(h.substr(2,2),16),b=parseInt(h.substr(4,2),16);
>   var mix=function(c){return Math.round(c+(255-c)*0.35);};
>   return 'rgb('+mix(r)+','+mix(g)+','+mix(b)+')';
> }
> ```
> For "Not for the Faint of Heart" (`#E24B4A`) this yields the prototype's
> `#f0837f` tag color.

## Exercises tab intro + search (unchanged structure, restyled via CSS only)

```js
html='<div style="font-size:12px;color:#a6a6ad;line-height:1.5;margin-bottom:12px;">Cardio &amp; conditioning exercise library. On any conditioning workout, tap <b style="color:#e6c579;">🔁 Swap</b> to live-replace a movement with one of these.</div>'
  +'<input placeholder="Search exercises…" oninput="renderCondLib(this.value)" style="width:100%;padding:11px 13px;border-radius:11px;border:1px solid rgba(255,255,255,0.12);background:rgba(255,255,255,0.05);color:#f4f3f1;font-size:14px;font-family:inherit;outline:none;margin-bottom:14px;">'
  +'<div id="condLib">'+(window.MCSubs?MCSubs.libGroupsHTML('',false):'')+'</div>';
```
(only the intro text's `<b>` color and the input's border/bg/text colors
change to Onyx tokens — no structural change)
