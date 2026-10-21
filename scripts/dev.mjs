import {spawn} from 'node:child_process';
import {writeBindings} from './runtime-config.mjs';
writeBindings('.dev.vars');
const child=spawn(process.execPath,['./node_modules/vinext/dist/cli.js','dev','--port',process.env.PORT??'5173'],{stdio:'inherit'});
for(const signal of ['SIGINT','SIGTERM'])process.on(signal,()=>child.kill(signal));
child.on('exit',code=>process.exit(code??1));
