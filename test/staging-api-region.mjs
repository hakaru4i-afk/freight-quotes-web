// Database-intensive staging requests execute beside the Frankfurt database.
// One request per operation; this module never retries an ambiguous write.
const prefix='https://ibclzdkxiozbzmniiygv.supabase.co/functions/v1/freight-api/api/';
export function stagingRegionalUrl(value){
 if(typeof value!=='string'||!value.startsWith(prefix))throw Error('STAGING_API_SCOPE_REQUIRED');
 const url=new URL(value);url.searchParams.set('forceFunctionRegion','eu-central-1');return url.href;
}
