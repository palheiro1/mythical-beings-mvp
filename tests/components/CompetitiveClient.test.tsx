import {act,render,renderHook,screen,waitFor} from '@testing-library/react';
import {beforeEach,describe,expect,it,vi} from 'vitest';
import {MemoryRouter,Route,Routes} from 'react-router-dom';
import {webcrypto} from 'node:crypto';
import {COMPETITIVE_CATALOG,initializeCompetitiveMatch,projectMatch} from '@mythicalb/wisdom-duel-engine';
import {useCompetitiveMatch} from '../../src/hooks/useCompetitiveMatch.js';
import ProtectedRoute from '../../src/components/ProtectedRoute.js';

const mocks=vi.hoisted(()=>({projection:vi.fn(),command:vi.fn(),channel:vi.fn(),removeChannel:vi.fn(),user:{id:'018f2f9a-4e1c-7b8a-8f2c-0242ac120003',isGuest:false}}));
vi.mock('../../src/services/competitiveService.js',()=>({competitive:{projection:mocks.projection,command:mocks.command},competitiveError:(e:Error)=>e.message}));
vi.mock('../../src/services/mythicalClient.js',()=>({playHubSupabase:{channel:mocks.channel,removeChannel:mocks.removeChannel}}));
vi.mock('../../src/hooks/useAuth.js',()=>({useAuth:()=>({user:mocks.user,polygonWallet:null,loading:false})}));
const other='018f2f9a-4e1c-7b8a-8f2c-0242ac120004',id='018f2f9a-4e1c-7b8a-8f2c-0242ac120002';
const deferred=<T,>()=>{let resolve!:(value:T)=>void;const promise=new Promise<T>(r=>{resolve=r;});return {promise,resolve};};
async function response(matchId=id){
  const snapshot=await initializeCompetitiveMatch({matchId,mode:'league',players:[mocks.user.id,other],selections:[COMPETITIVE_CATALOG.slice(0,3),COMPETITIVE_CATALOG.slice(0,3)],seedHex:'ab'.repeat(32),now:new Date().toISOString()});
  return {match:{matchId,mode:'league',status:'playing'},projection:projectMatch(snapshot,mocks.user.id,snapshot.clock.updatedAt),serverNow:snapshot.clock.updatedAt};
}
beforeEach(()=>{vi.clearAllMocks();sessionStorage.clear();vi.stubGlobal('crypto',webcrypto);mocks.channel.mockImplementation(()=>({on(){return this;},subscribe(){return this;}}));mocks.removeChannel.mockResolvedValue(undefined);});
describe('competitive account and recovery',()=>{
  it('admits a persistent league account without a wallet',()=>{
    render(<MemoryRouter initialEntries={['/league']}><Routes><Route element={<ProtectedRoute/>}><Route path="/league" element={<p>Liga disponível</p>}/></Route><Route path="/" element={<p>Login</p>}/></Routes></MemoryRouter>);
    expect(screen.getByText('Liga disponível')).toBeInTheDocument();
  });
  it('retries the identical command after the commit response is lost and does not update optimistically',async()=>{
    const initial=await response();mocks.projection.mockResolvedValue(initial);
    mocks.command.mockRejectedValueOnce(Object.assign(new Error('Connection lost'),{code:'connection_failed'}));
    const {result,unmount}=renderHook(()=>useCompetitiveMatch(id,mocks.user.id));
    await waitFor(()=>expect(result.current.data?.projection?.stateVersion).toBe(0));
    await act(async()=>{await result.current.submit({type:'resign'});});
    expect(result.current.retryable).toBe(true);expect(result.current.data?.projection?.stateVersion).toBe(0);
    const sent=mocks.command.mock.calls[0][0];
    mocks.command.mockResolvedValueOnce({status:'duplicate',projection:initial.projection});
    await act(async()=>{await result.current.submit();});
    expect(mocks.command.mock.calls[1][0]).toEqual(sent);expect(result.current.retryable).toBe(false);unmount();
  });
  it('ignores a delayed response for a previous match after navigation',async()=>{
    const nextId=crypto.randomUUID(),old=await response(),next=await response(nextId),late=deferred<typeof old>();
    mocks.projection.mockImplementation((matchId:string)=>matchId===id?late.promise:Promise.resolve(next));
    const {result,rerender,unmount}=renderHook(({matchId})=>useCompetitiveMatch(matchId,mocks.user.id),{initialProps:{matchId:id}});
    rerender({matchId:nextId});await waitFor(()=>expect(result.current.data?.match.matchId).toBe(nextId));
    await act(async()=>{late.resolve(old);await late.promise;});expect(result.current.data?.match.matchId).toBe(nextId);unmount();
  });
});
