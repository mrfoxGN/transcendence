import { useEffect, useState } from 'react';
import { workspaceRequest } from './workspace-api';

/** Files and Notes APIs support page/limit only. Collect metadata before local search/filter/sort. */
export function useWorkspaceDocumentCollection<T>(path:string,token:string|null){
 const [data,setItems]=useState<T[]>();
 const [loaded,setLoaded]=useState('');
 const [failed,setFailed]=useState('');
 const [errorMessage,setErrorMessage]=useState('');
 const [attempt,setAttempt]=useState(0);
 const key=path+'|'+token;
 useEffect(()=>{
  if(!token)return;
  const controller=new AbortController();
  void (async()=>{
   try {
    const collected:T[]=[];
    for(let page=1;;page++){
     const query=new URLSearchParams({page:String(page),limit:'100'});
     const response=await workspaceRequest(path+'?'+query,token,{signal:controller.signal});
     const batch=await response.json() as T[];
     if(controller.signal.aborted)return;
     if(!Array.isArray(batch))throw new Error('Unexpected document-list response.');
     collected.push(...batch);
     if(batch.length<100)break;
    }
    setItems(collected);setLoaded(key);setFailed('');setErrorMessage('');
   }catch(error){if(!controller.signal.aborted){setFailed(key);setErrorMessage(error instanceof Error?error.message:'Could not load documents.');}}
  })();
  return()=>controller.abort();
 },[path,token,key,attempt]);
 return {items:loaded===key?data:undefined,setItems,error:failed===key,errorMessage,retry:()=>{setFailed('');setAttempt(value=>value+1);}};
}
