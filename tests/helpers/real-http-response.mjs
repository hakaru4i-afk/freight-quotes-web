// Consume the real network body before returning, including status-only denial
// checks. No response fixtures, retries, status rewriting or timeout changes.
export async function fetchComplete(url,options,onHeaders){
 const response=await fetch(url,options);onHeaders?.(response);
 const bytes=await response.arrayBuffer();
 return new Response([204,205,304].includes(response.status)?null:bytes,{
  status:response.status,statusText:response.statusText,headers:response.headers
 });
}
