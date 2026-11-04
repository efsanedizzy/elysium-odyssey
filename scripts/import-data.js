import { readFile } from 'node:fs/promises';
import { createStorage, emptyStore } from '../server/storage.js';

if(!process.env.DATABASE_URL)throw Error('Set DATABASE_URL in your environment first.');
if(!process.argv[2])throw Error('Usage: node --env-file=.env scripts/import-data.js path/to/odyssey.json');
const source=JSON.parse(await readFile(process.argv[2],'utf8'));
if(!source.users||!source.claimedTransactions)throw Error('Invalid Odyssey export.');
const storage=createStorage();
try{
  await storage.transaction(target=>{
    if(Object.keys(target.users).length||Object.keys(target.sessions).length||Object.keys(target.claimedTransactions).length)
      throw Error('Destination is not empty. Import refused to protect existing progress.');
    Object.assign(target,emptyStore(),{users:source.users,claimedTransactions:source.claimedTransactions});
  });
  console.log('Imported wallet progress. Users must sign in again; pending logins were not imported.');
}finally{await storage.close();}
