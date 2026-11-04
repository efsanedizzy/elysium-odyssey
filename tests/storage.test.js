import test from 'node:test';
import assert from 'node:assert/strict';
import { createStorage } from '../server/storage.js';

test('Vercel refuses ephemeral file storage when DATABASE_URL is missing',async()=>{
  const previous=process.env.VERCEL;process.env.VERCEL='1';
  try{await assert.rejects(createStorage({connectionString:''}).transaction(()=>{}),/DATABASE_URL is required/);}
  finally{if(previous===undefined)delete process.env.VERCEL;else process.env.VERCEL=previous;}
});
