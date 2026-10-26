import { ConfigService } from '@nestjs/config';
import { BrowserService } from '../../../../src/lib/browser/browser.service.js';
vi.mock('node:dns/promises',()=>({lookup:vi.fn()}));
import { lookup } from 'node:dns/promises';
describe('local browser destination policy',()=>{
  const service=new BrowserService(new ConfigService({COMPUTER_BROWSER_DOMAINS:['example.com']}));
  afterEach(()=>vi.resetAllMocks());
  it('rejects local resources, unlisted hosts, credentials and executable schemes',async()=>{
    for(const value of ['file:///etc/passwd','javascript:alert(1)','http://127.0.0.1','http://[::1]','https://other.com','https://user:pass@example.com','http://example.com:3001'])await expect(service.allowedUrl(value)).rejects.toThrow();
    expect(lookup).not.toHaveBeenCalled();
  });
  it('rejects an allowed hostname resolving to private or mixed public/private addresses',async()=>{
    for(const address of ['10.0.0.1','127.0.0.1','169.254.169.254','192.168.1.1','::1','::ffff:127.0.0.1','fc00::1']){
      vi.mocked(lookup).mockResolvedValue([{address,family:address.includes(':')?6:4}] as never);
      await expect(service.allowedUrl('https://example.com')).rejects.toThrow(/Private/);
    }
  });
  it('accepts an allowed public destination',async()=>{
    vi.mocked(lookup).mockResolvedValue([{address:'93.184.216.34',family:4}] as never);
    await expect(service.allowedUrl('https://example.com')).resolves.toMatchObject({hostname:'example.com'});
  });
});
