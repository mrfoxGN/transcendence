import { Children, Fragment, isValidElement, useEffect, useId, useLayoutEffect, useRef, useState, type ReactNode, type SelectHTMLAttributes, type KeyboardEvent } from 'react';
import { Check, ChevronDown, Search } from 'lucide-react';
import './select.css';

type Option = { value:string; label:string; disabled:boolean; group?:string };
type Props = SelectHTMLAttributes<HTMLSelectElement> & { searchable?:boolean };
function text(node:ReactNode):string { return Children.toArray(node).map(child => isValidElement<{children?:ReactNode}>(child) ? text(child.props.children) : String(child ?? '')).join(''); }
function optionsFrom(children:ReactNode, group?:string, disabled=false):Option[] {
 const result:Option[]=[];
 Children.forEach(children, child => {
  if(!isValidElement<{children?:ReactNode;value?:string|number;disabled?:boolean;label?:string}>(child))return;
  if(child.type===Fragment)result.push(...optionsFrom(child.props.children,group,disabled));
  else if(child.type==='optgroup')result.push(...optionsFrom(child.props.children,child.props.label,disabled||!!child.props.disabled));
  else if(child.type==='option'){const label=child.props.label??text(child.props.children);result.push({value:String(child.props.value??label),label,disabled:disabled||!!child.props.disabled,group});}
 });return result;
}

/** Custom presentation with a native form control retaining the existing value and change contract. */
export function Select({children,value,defaultValue,onChange,onInvalid,className='',searchable,...props}:Props) {
 const options=optionsFrom(children),first=options.find(option=>!option.disabled)??options[0];
 const [localValue,setLocalValue]=useState(String(defaultValue??first?.value??''));
 const selected=String(value??localValue),choice=options.find(option=>option.value===selected);
 const [open,setOpen]=useState(false),[query,setQuery]=useState(''),[active,setActive]=useState(-1),[label,setLabel]=useState('Choose an option'),[invalid,setInvalid]=useState(false);
 const native=useRef<HTMLSelectElement>(null),trigger=useRef<HTMLButtonElement>(null),popup=useRef<HTMLDivElement>(null),search=useRef<HTMLInputElement>(null);
 const typeahead=useRef({value:'',at:0});const id=useId();const listId=id+'-list',errorId=id+'-error';
 const canSearch=searchable??options.length>7;
 const filtered=options.filter(option=>option.label.toLocaleLowerCase().includes(query.toLocaleLowerCase()));
 const available=filtered.map((option,index)=>({option,index})).filter(item=>!item.option.disabled);
 const activeId=active>=0&&filtered[active]?id+'-option-'+active:undefined;
 useLayoutEffect(()=>{
  if(props['aria-label']){setLabel(props['aria-label']);return;}
  const source=native.current?.labels?.[0];if(!source)return;
  const copy=source.cloneNode(true) as HTMLElement;copy.querySelectorAll('[data-devup-select],.wu-field-hint').forEach(element=>element.remove());
  setLabel(copy.textContent?.trim().replace(/\s+/g,' ')||'Choose an option');
 });
 function close(restore=false){setOpen(false);popup.current?.hidePopover();if(restore)trigger.current?.focus({preventScroll:true});}
 function position(){
  if(!popup.current||!trigger.current)return;
  const rect=trigger.current.getBoundingClientRect(),gap=6,padding=12;
  if(rect.bottom<0||rect.top>innerHeight){close();return;}
  const below=innerHeight-rect.bottom-padding,above=rect.top-padding;
  const height=Math.min(340,Math.max(100,Math.max(below,above)-gap));
  const width=Math.min(Math.max(rect.width,220),innerWidth-padding*2);
  popup.current.dataset.side=below>=Math.min(height,240)||below>=above?'below':'above';
  Object.assign(popup.current.style,{width:width+'px',maxHeight:height+'px',left:Math.max(padding,Math.min(rect.left,innerWidth-width-padding))+'px',top:(below>=Math.min(height,240)||below>=above?rect.bottom+gap:Math.max(padding,rect.top-Math.min(height,popup.current.scrollHeight)-gap))+'px'});
 }
 function show(initialQuery=''){
  if(props.disabled)return;
  setQuery(initialQuery);const visible=options.filter(option=>option.label.toLocaleLowerCase().includes(initialQuery.toLocaleLowerCase()));const chosen=visible.findIndex(option=>option.value===selected&&!option.disabled);setActive(chosen>=0?chosen:visible.findIndex(option=>!option.disabled));
  setOpen(true);popup.current?.showPopover();position();
  if(canSearch)requestAnimationFrame(()=>search.current?.focus({preventScroll:true}));
 }
 useEffect(()=>{
  if(!open)return;
  position();window.addEventListener('resize',position);window.addEventListener('scroll',position,true);
  return()=>{window.removeEventListener('resize',position);window.removeEventListener('scroll',position,true);};
 },[open,query]);
 useEffect(()=>{if(props.autoFocus)trigger.current?.focus();},[props.autoFocus]);
 useEffect(()=>{if(props.disabled&&open)close();},[props.disabled,open]);
 useEffect(()=>{if(activeId)document.getElementById(activeId)?.scrollIntoView({block:'nearest'});},[activeId]);
 useEffect(()=>{const form=native.current?.form;if(!form)return;const reset=()=>{setLocalValue(String(defaultValue??first?.value??''));setInvalid(false);close();};form.addEventListener('reset',reset);return()=>form.removeEventListener('reset',reset);},[defaultValue,first?.value]);
 function choose(option:Option){
  if(option.disabled||!native.current)return;
  if(option.value===selected){setInvalid(false);close(true);return;}
  const control=native.current;control.value=option.value;
  setInvalid(false);close(true);
  control.dispatchEvent(new Event('change',{bubbles:true}));
 }
 function keydown(event:KeyboardEvent<HTMLElement>){
  if(event.key==='Escape'&&open){event.preventDefault();event.stopPropagation();close(true);return;}
  if(event.key==='Tab'){if(open)close(true);return;}
  if(['ArrowDown','ArrowUp','Home','End'].includes(event.key)){
   if(event.currentTarget===search.current&&['Home','End'].includes(event.key))return;
   event.preventDefault();if(!open){show();return;}
   const current=available.findIndex(item=>item.index===active);
   const next=event.key==='Home'?0:event.key==='End'?available.length-1:event.key==='ArrowDown'?(current+1)%available.length:(current<0?available.length-1:(current-1+available.length)%available.length);
   setActive(available[next]?.index??-1);return;
  }
  if(event.key==='Enter'||(event.key===' '&&event.currentTarget!==search.current)){
   event.preventDefault();if(!open)show();else if(filtered[active])choose(filtered[active]);return;
  }
  if(event.currentTarget!==search.current&&event.key.length===1&&!event.ctrlKey&&!event.metaKey&&!event.altKey){
   event.preventDefault();if(canSearch){show(event.key);return;}
   const now=Date.now();typeahead.current={value:now-typeahead.current.at>700?event.key:typeahead.current.value+event.key,at:now};
   if(!open)show();setActive(options.findIndex(option=>!option.disabled&&option.label.toLocaleLowerCase().startsWith(typeahead.current.value.toLocaleLowerCase())));
  }
 }
 return <span className="wu-select-control" data-devup-select="" data-disabled={props.disabled||undefined}>
  <select {...props} ref={native} value={selected} tabIndex={-1} aria-hidden="true" className="wu-select-native" onFocus={()=>trigger.current?.focus()} onChange={event=>{setLocalValue(event.currentTarget.value);setInvalid(false);onChange?.(event);}} onInvalid={event=>{event.preventDefault();setInvalid(true);trigger.current?.focus();onInvalid?.(event);}}>{children}</select>
  <button ref={trigger} type="button" className={'wu-select-trigger '+className} role="combobox" aria-label={props['aria-labelledby']?undefined:label} aria-labelledby={props['aria-labelledby']} aria-describedby={[props['aria-describedby'],invalid?errorId:''].filter(Boolean).join(' ')||undefined} aria-invalid={props['aria-invalid']||invalid||undefined} aria-required={props.required||undefined} aria-expanded={open} aria-controls={listId} aria-haspopup="listbox" aria-activedescendant={!canSearch&&open?activeId:undefined} disabled={props.disabled} onKeyDown={keydown} onClick={()=>open?close():show()}><span>{choice?.label??'Choose an option'}</span><ChevronDown size={15} aria-hidden="true"/></button>
  <div ref={popup} popover="auto" className="wu-select-popup" onToggle={event=>{const expanded=(event.nativeEvent as ToggleEvent).newState==='open';setOpen(expanded);if(expanded)position();}} onKeyDown={keydown}>
   {canSearch&&<label className="wu-select-search"><Search size={15} aria-hidden="true"/><input ref={search} type="search" aria-label={'Search '+label.toLocaleLowerCase()} aria-controls={listId} aria-activedescendant={activeId} value={query} onChange={event=>{setQuery(event.target.value);setActive(options.filter(option=>option.label.toLocaleLowerCase().includes(event.target.value.toLocaleLowerCase())).findIndex(option=>!option.disabled));}} onKeyDown={event=>{event.stopPropagation();keydown(event);}} placeholder="Search options…"/></label>}
   <div id={listId} role="listbox" aria-label={label} className="wu-select-options">
    {filtered.map((option,index)=><Fragment key={option.value}>{option.group&&(index===0||filtered[index-1].group!==option.group)&&<div className="wu-select-group" role="presentation">{option.group}</div>}<div id={id+'-option-'+index} role="option" aria-selected={selected===option.value} aria-disabled={option.disabled||undefined} className="wu-select-option" data-active={index===active||undefined} onMouseMove={()=>{if(!option.disabled)setActive(index);}} onMouseDown={event=>event.preventDefault()} onClick={()=>choose(option)}><span>{option.label}</span>{selected===option.value&&<Check size={15} aria-hidden="true"/>}</div></Fragment>)}
    {!filtered.length&&<p className="wu-select-empty" role="status">No options found</p>}
   </div>
  </div>
  {invalid&&<span id={errorId} className="wu-select-error" role="alert">Choose an option.</span>}
 </span>;
}
