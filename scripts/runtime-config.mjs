import {existsSync,writeFileSync} from 'node:fs';
process.env.CLOUDFLARE_CF_FETCH_ENABLED??='false';
process.env.WRANGLER_SEND_METRICS??='false';
export function writeBindings(target){
 if(existsSync('.env'))process.loadEnvFile('.env');
 const allowed=['LLM_API_KEY','LLM_BASE_URL','LLM_MODEL'];
 const lines=allowed.filter(k=>process.env[k]).map(k=>k+'='+JSON.stringify(process.env[k]));
 writeFileSync(target,lines.join('\n')+'\n',{mode:0o600});
}
