export async function readBoundedJson(req:Request,maxBytes:number):Promise<any>{
  if(!req.body)throw new Error('INVALID_JSON_BODY');
  const reader=req.body.getReader();
  const chunks:Uint8Array[]=[];let total=0;
  try{
    for(;;){
      const {done,value}=await reader.read();if(done)break;
      total+=value.length;
      if(total>maxBytes)throw new Error('HTTP_BODY_TOO_LARGE');
      chunks.push(value);
    }
  }finally{reader.releaseLock();}
  const bytes=new Uint8Array(total);let offset=0;
  for(const chunk of chunks){bytes.set(chunk,offset);offset+=chunk.length;}
  try{return JSON.parse(new TextDecoder('utf-8',{fatal:true}).decode(bytes))}
  catch{throw new Error('INVALID_JSON_BODY')}
}
