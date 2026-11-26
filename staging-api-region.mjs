// Production requests execute beside the Frankfurt database.
// Only this project's legacy and exact immutable release endpoints are allowed.
// One request per operation; never retry an ambiguous write.
const origin='https://ooclsrndeygojtofuyte.supabase.co';
const route=/^\/functions\/v1\/freight-api(?:-release-[a-f0-9]{32})?\/api\//;
export function stagingRegionalUrl(value){
 if(typeof value!=='string')throw Error('PRODUCTION_API_SCOPE_REQUIRED');
 const url=new URL(value);
 if(url.origin!==origin||url.username||url.password||!route.test(url.pathname))throw Error('PRODUCTION_API_SCOPE_REQUIRED');
 url.searchParams.set('forceFunctionRegion','eu-central-1');return url.href;
}
