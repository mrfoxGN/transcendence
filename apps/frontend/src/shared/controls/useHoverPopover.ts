import { useEffect, useRef, useState, type FocusEvent, type KeyboardEvent, type MouseEvent, type PointerEvent } from 'react';

/** Pointer intent enhances an ordinary clickable, keyboard-accessible popover. */
export function useHoverPopover<T extends HTMLElement = HTMLDivElement>(onOpen?: (trigger: HTMLButtonElement | null) => void) {
 const callback=useRef(onOpen);callback.current=onOpen;
 const trigger=useRef<HTMLButtonElement>(null),panel=useRef<T>(null);
 const [open,setOpen]=useState(false);
 const opening=useRef<number|undefined>(undefined),closing=useRef<number|undefined>(undefined);
 const explicit=useRef(false),pointer=useRef({trigger:false,panel:false});
 const clear=(timer:typeof opening)=>{if(timer.current!==undefined){clearTimeout(timer.current);timer.current=undefined;}};
 const isOpen=()=>!!panel.current?.matches(':popover-open');
 const hasFocus=()=>!!panel.current?.contains(document.activeElement)||document.activeElement===trigger.current;
 function hide(restore=false){clear(opening);clear(closing);panel.current?.hidePopover();explicit.current=false;setOpen(false);if(restore)trigger.current?.focus({preventScroll:true});}
 function show(pinned:boolean,focus=false){clear(opening);clear(closing);const wasOpen=isOpen();explicit.current=pinned;if(panel.current)panel.current.dataset.hoverIntent=String(!pinned);if(!wasOpen)callback.current?.(trigger.current);panel.current?.showPopover();setOpen(true);if(focus)panel.current?.querySelector<HTMLElement>('button:not(:disabled),summary,input:not(:disabled),a[href],select:not(:disabled)')?.focus({preventScroll:true});}
 function enter(event:PointerEvent<HTMLElement>,part:'trigger'|'panel'){
  if(event.pointerType!=='mouse'||!matchMedia('(hover:hover) and (pointer:fine)').matches)return;
  pointer.current[part]=true;clear(closing);
  if(part==='trigger'&&!isOpen()){
   clear(opening);opening.current=window.setTimeout(()=>{
    opening.current=undefined;
    if(!pointer.current.trigger||document.querySelector('dialog[open],.wu-overlay')||[...document.querySelectorAll(':popover-open')].some(element=>element!==panel.current&&(element as HTMLElement).dataset.hoverIntent!=='true'))return;
    show(false);
   },200);
  }
 }
 function leave(event:PointerEvent<HTMLElement>,part:'trigger'|'panel'){
  if(event.pointerType!=='mouse')return;
  pointer.current[part]=false;clear(opening);clear(closing);
  if(explicit.current)return;
  closing.current=window.setTimeout(()=>{if(!pointer.current.trigger&&!pointer.current.panel&&!hasFocus())hide();},220);
 }
 function blur(event:FocusEvent<HTMLElement>){
  const next=event.relatedTarget as Node|null;
  if(next&&(panel.current?.contains(next)||trigger.current?.contains(next)))return;
  clear(closing);closing.current=window.setTimeout(()=>{if(!hasFocus()&&!pointer.current.trigger&&!pointer.current.panel)hide();},220);
 }
 useEffect(()=>()=>{clear(opening);clear(closing);},[]);
 return {
  triggerProps:{ref:trigger,'aria-expanded':open,onPointerEnter:(event:PointerEvent<HTMLButtonElement>)=>enter(event,'trigger'),onPointerLeave:(event:PointerEvent<HTMLButtonElement>)=>leave(event,'trigger'),onBlurCapture:blur,
   onClick:(event:MouseEvent<HTMLButtonElement>)=>{event.preventDefault();if(isOpen()&&explicit.current)hide();else show(true,event.detail===0);},
   onKeyDown:(event:KeyboardEvent<HTMLButtonElement>)=>{if(event.key==='ArrowDown'){event.preventDefault();show(true,true);}else if(event.key==='Escape'&&isOpen()){event.preventDefault();event.stopPropagation();hide();}}
  },
  panelProps:{ref:panel,onPointerEnter:(event:PointerEvent<T>)=>enter(event,'panel'),onPointerLeave:(event:PointerEvent<T>)=>leave(event,'panel'),onBlurCapture:blur,
   onToggle:()=>{const expanded=isOpen();setOpen(expanded);if(!expanded){explicit.current=false;clear(opening);clear(closing);}},
   onKeyDown:(event:KeyboardEvent<T>)=>{if(event.key==='Escape'){event.preventDefault();event.stopPropagation();hide(true);}}
  }
 };
}
