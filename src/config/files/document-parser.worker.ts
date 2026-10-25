// Trusted worker code, never user-supplied JavaScript. Keep CPU-heavy document
// parsing off the API thread and terminate the worker on timeout or cancellation.
export const DOCUMENT_PARSER_WORKER = String.raw`
const {parentPort,workerData}=require('node:worker_threads');
(async()=>{
  const {kind,paths}=workerData;
  const buffer=Buffer.from(workerData.buffer);
  let text='',pages;
  if(kind==='jpg'||kind==='jpeg'||kind==='png') {
    const sharp=(await import(paths.sharp)).default;
    const isPng=buffer.subarray(0,8).equals(Buffer.from([137,80,78,71,13,10,26,10]));
    const isJpeg=buffer[0]===255&&buffer[1]===216&&buffer[2]===255;
    if(kind==='png'?!isPng:!isJpeg)throw Error('Invalid image signature');
    const image=sharp(buffer,{limitInputPixels:12_000_000,failOn:'warning'});
    const metadata=await image.metadata();
    if(!['jpeg','png'].includes(metadata.format)||(metadata.pages??1)>1)throw Error('Unsupported image');
    const normalized=await image.rotate().resize({width:1600,height:1600,fit:'inside',withoutEnlargement:true}).toFormat(kind==='png'?'png':'jpeg').toBuffer();
    if(normalized.length>1_048_576)throw Error('Normalized image exceeds limit');
    parentPort.postMessage({text:'',kind:'image',content:normalized});return;
  }
  if(kind==='pdf') {
    if(buffer.subarray(0,5).toString()!=='%PDF-')throw Error('Invalid PDF signature');
    const {getDocument}=await import(paths.pdf);
    const loading=getDocument({data:new Uint8Array(buffer),isEvalSupported:false,useSystemFonts:false,disableFontFace:true,verbosity:0});
    const doc=await loading.promise;
    try {
      pages=doc.numPages;if(pages>50)throw Error('PDF exceeds 50 pages');
      for(let n=1;n<=pages;n++) {
        const page=await doc.getPage(n);
        const content=await page.getTextContent();
        text+='\n'+content.items.map(item=>'str' in item?item.str+(item.hasEOL?'\n':' '):'').join('');
        if(text.length>200_000)throw Error('Extracted text exceeds limit');
        page.cleanup();
      }
    } finally {await loading.destroy();}
  } else if(kind==='docx') {
    if(buffer.readUInt32LE(0)!==0x04034b50)throw Error('Invalid DOCX signature');
    const {unzipSync}=await import(paths.zip);
    let entries=0;
    const archive=unzipSync(buffer,{filter:file=>{
      if(++entries>1000||file.originalSize>2_000_000)throw Error('DOCX expansion limit');
      return file.name==='word/document.xml'||file.name==='[Content_Types].xml';
    }});
    if(!archive['word/document.xml']||!archive['[Content_Types].xml'])throw Error('Invalid DOCX package');
    const xml=new TextDecoder('utf-8',{fatal:true}).decode(archive['word/document.xml']);
    if(xml.length>2_000_000||/<!DOCTYPE|<!ENTITY/i.test(xml))throw Error('Unsafe DOCX XML');
    const {XMLParser,XMLValidator}=await import(paths.xml);
    if(XMLValidator.validate(xml)!==true)throw Error('Invalid document XML');
    const nodes=new XMLParser({preserveOrder:true,ignoreAttributes:true,trimValues:false,parseTagValue:false}).parse(xml);
    function visit(nodes,depth=0) {
      if(depth>100)throw Error('XML nesting limit');
      for(const node of nodes)for(const [key,value] of Object.entries(node)) {
        if(key==='w:t')text+=value.map(part=>part['#text']??'').join('');
        else if(key==='w:tab')text+='\t';
        else if(key==='w:br')text+='\n';
        else if(Array.isArray(value)){visit(value,depth+1);if(key==='w:p')text+='\n';}
        if(text.length>200_000)throw Error('Extracted text exceeds limit');
      }
    }
    visit(nodes);
  } else throw Error('Unsupported document');
  parentPort.postMessage({text:text.trim(),kind:kind==='pdf'?'pdf':'text',pages});
})().catch(()=>{parentPort.postMessage({error:true});});
`;
