import { useEffect, useRef, type PointerEvent, type KeyboardEvent, type MouseEvent } from 'react';

/** An inline disclosure keeps the same intent delay as the surrounding menus. */
export function useHoverDisclosure() {
 const panel=useRef<HTMLDetailsElement>(null);
 const opening=useRef<number|undefined>(undefined),closing=useRef<number|undefined>(undefined);
 const pinned=useRef(false);
 const clear=()=>{clearTimeout(opening.current);clearTimeout(closing.current);};
 const close=()=>{if(panel.current)panel.current.open=false;pinned.current=false;};
 useEffect(()=>()=>clear(),[]);
 return {
  detailsProps:{ref:panel,onPointerEnter:()=>clearTimeout(closing.current),onPointerLeave:(event:PointerEvent<HTMLDetailsElement>)=>{if(event.pointerType!=='mouse')return;clear();closing.current=window.setTimeout(()=>{if(!pinned.current&&!panel.current?.contains(document.activeElement))close();},220);},
   onBlurCapture:()=>{clearTimeout(closing.current);closing.current=window.setTimeout(()=>{if(!pinned.current&&!panel.current?.matches(':hover')&&!panel.current?.contains(document.activeElement))close();},220);},
   onKeyDown:(event:KeyboardEvent<HTMLDetailsElement>)=>{if(event.key==='Escape'&&panel.current?.open){event.preventDefault();event.stopPropagation();close();panel.current.querySelector('summary')?.focus();}}
  },
  summaryProps:{onPointerEnter:(event:PointerEvent<HTMLElement>)=>{if(event.pointerType!=='mouse'||!matchMedia('(hover:hover) and (pointer:fine)').matches)return;clear();opening.current=window.setTimeout(()=>{if(panel.current)panel.current.open=true;},200);},onPointerLeave:()=>clearTimeout(opening.current),
   onClick:(event:MouseEvent<HTMLElement>)=>{event.preventDefault();clear();if(panel.current?.open&&pinned.current)close();else{pinned.current=true;if(panel.current)panel.current.open=true;}},
   onKeyDown:(event:KeyboardEvent<HTMLElement>)=>{if(event.key==='ArrowDown'){event.preventDefault();clear();pinned.current=true;if(panel.current){panel.current.open=true;panel.current.querySelector<HTMLInputElement>('input:checked')?.focus();}}}
  }
 };
}
