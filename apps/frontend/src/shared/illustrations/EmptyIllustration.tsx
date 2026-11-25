import { Button } from '../ui/Button';
import './empty-states.css';
export const emptyKinds=['tasks','projects','files','notes','messages','notifications','search','analytics','team','integrations','activity','calendar','invitations','restricted','offline','error'] as const;
export type EmptyKind=typeof emptyKinds[number];
export function EmptyIllustration({kind,size=152}:{kind:EmptyKind;size?:number}){
 return <span className="devup-empty-art" style={{width:size,height:size}} aria-hidden="true">
  <img className="devup-empty-art__light" src={'/illustrations/empty-states/geometric/light/'+kind+'.webp'} width={360} height={360} decoding="async" alt="" draggable={false}/>
  <img className="devup-empty-art__dark" src={'/illustrations/empty-states/geometric/dark/'+kind+'.webp'} width={360} height={360} decoding="async" alt="" draggable={false}/>
 </span>;
}
export function IllustratedEmptyState({kind,title,detail,action,onAction,compact=false}:{kind:EmptyKind;title:string;detail?:string;action?:string;onAction?:()=>void;compact?:boolean}){
 return <section className={'devup-empty-state'+(compact?' devup-empty-state--compact':'')} data-empty-kind={kind}>
 <EmptyIllustration kind={kind} size={compact?104:144}/><h3>{title}</h3>{detail&&<p>{detail}</p>}{action&&onAction&&<Button variant="primary" onClick={onAction}>{action}</Button>}
 </section>;
}
