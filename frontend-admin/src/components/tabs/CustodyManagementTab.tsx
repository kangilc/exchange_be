import React, { useState } from 'react';
import { useExchangeStore } from '../../store/useExchangeStore';
import { Coins, ArrowUpRight, ArrowDownRight, Users } from 'lucide-react';

interface CustodyManagementTabProps {
    handleViewTx: (txHash: string) => void;
}

export const CustodyManagementTab: React.FC<CustodyManagementTabProps> = ({ handleViewTx }) => {
    const {
        hotWallets,
        blockHeight,
        pendingDeposits,
        userCryptoAddresses,
        btcConfirmations,
        ethConfirmations,
        adaConfirmations,
        cryptoWithdrawals,
        onChainDepositMonitoringEnabled,
        apiBaseUrl,
        rebalanceHotWallet,
        requestCryptoWithdrawal,
        approveWithdrawal,
        rejectWithdrawal,
        fetchHotWallets,
        fetchCryptoWithdrawals,
        fetchUserCryptoAddresses,
        fetchPendingDeposits,
        fetchBlockHeight
    } = useExchangeStore();

    React.useEffect(() => {
        const loadData = () => {
            fetchHotWallets();
            fetchCryptoWithdrawals();
            fetchUserCryptoAddresses();
            fetchPendingDeposits();
            fetchBlockHeight();
        };
        loadData();
        const interval = setInterval(loadData, 3000);
        return () => clearInterval(interval);
    }, [fetchHotWallets, fetchCryptoWithdrawals, fetchUserCryptoAddresses, fetchPendingDeposits, fetchBlockHeight]);

    // Local withdrawal form states
    const [custodyWithdrawUserId, setCustodyWithdrawUserId] = useState('');
    const [custodyWithdrawCurrency, setCustodyWithdrawCurrency] = useState('BTC');
    const [custodyWithdrawAmount, setCustodyWithdrawAmount] = useState('');
    const [custodyWithdrawAddress, setCustodyWithdrawAddress] = useState('');

    const handleTestJafDeposit = async () => {
        const amount = prompt("테스트로 입금할 JAF 수량을 입력하세요 (예: 50):", "50");
        if (!amount || isNaN(Number(amount))) return;
        try {
            const res = await fetch(`${apiBaseUrl}/admin/crypto/test-jaf-deposit`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ userId: 1, amount: Number(amount) })
            });
            const result = await res.json();
            if (result.success || result.txHash) {
                alert(`JAF 테스트 입금이 성공적으로 전송되었습니다!\nTxHash: ${result.txHash}\n수신처: ${result.toAddress}\n\n잠시 후 입금 모니터링 테이블에 감지됩니다.`);
            } else {
                alert("에러: " + (result.error || "알 수 없는 오류"));
            }
        } catch (e) {
            console.error(e);
            alert("요청 전송 중 오류가 발생했습니다.");
        }
    };

    return (
        <div className="tab-panel animate-fade-in flex flex-col gap-6">
            <div className="section-title text-xl font-black text-white flex items-center justify-between">
                <div className="flex items-center gap-2">
                    <Coins size={20} className="text-[#8a2be2]" />
                    <span>온체인 커스터디(Custody) 자산 및 입출금 관리</span>
                </div>
                <div className="flex items-center gap-3 bg-white/5 border border-white/10 px-4 py-1.5 rounded-full text-xs text-slate-300 font-bold">
                    <Coins size={14} className="text-[#8a2be2] animate-pulse" />
                    <span>시뮬레이션 블록 높이: <span className="text-white font-mono">{blockHeight}</span></span>
                </div>
            </div>

            {/* 1. 핫 월렛 보유 현황 & 출금 테스트 */}
            <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
                {/* 핫 월렛 카드 (2열 차지) */}
                <div className="xl:col-span-2 bg-[#0a1020]/45 border border-white/5 rounded-2xl p-6 flex flex-col gap-4">
                    <div className="text-sm font-extrabold text-white border-b border-white/5 pb-2 flex items-center gap-2">
                        <Coins size={16} className="text-[#8a2be2]" />
                        <span>시스템 핫 월렛(System Hot Wallet) 잔고</span>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        {hotWallets.map((hw: any) => (
                            <div key={hw.walletId} className="p-4 bg-slate-900/40 border border-white/5 rounded-xl flex flex-col gap-3 justify-between hover:border-[#00f2fe]/30 transition-all duration-300">
                                <div className="flex flex-col gap-1">
                                    <div className="flex items-center justify-between">
                                        <span className="text-xs font-bold text-white">{hw.currency} 핫월렛</span>
                                        <span className="px-1.5 py-0.5 rounded text-[8px] font-extrabold bg-[#00f2fe]/10 border border-[#00f2fe]/30 text-[#00f2fe]">CUSTODY</span>
                                    </div>
                                    <span className="text-lg font-black text-white font-mono tracking-wider mt-1">{hw.balance.toLocaleString(undefined, { maximumFractionDigits: hw.currency === 'ADA' ? 2 : 6 })} <span className="text-[10px] text-slate-400 font-bold">{hw.currency}</span></span>
                                    <span className="text-[9px] text-slate-500 font-mono break-all mt-1">{hw.address}</span>
                                </div>
                                <div className="flex flex-col gap-1.5 border-t border-white/5 pt-2">
                                    <div className="flex items-center justify-between text-[9px] text-slate-400 font-bold">
                                        <span>안전 임계값:</span>
                                        <span className="text-amber-400">{hw.thresholdAmount} {hw.currency}</span>
                                    </div>
                                    {hw.balance < hw.thresholdAmount && (
                                        <span className="text-[8px] font-bold text-rose-400 bg-rose-500/10 border border-rose-500/20 px-1.5 py-0.5 rounded text-center">잔고 부족 경고 - 보충 필요</span>
                                    )}
                                    <button
                                        onClick={async () => {
                                            const amtStr = prompt(`${hw.currency} 핫월렛에 공급할 수량을 입력하세요:`, (hw.thresholdAmount * 2).toString());
                                            if (amtStr && !isNaN(Number(amtStr))) {
                                                const success = await rebalanceHotWallet(hw.walletId, Number(amtStr));
                                                if (success) alert(`${hw.currency} 핫월렛에 ${amtStr} 자산이 정상 공급되었습니다.`);
                                            }
                                        }}
                                        className="w-full py-1 bg-white/5 hover:bg-[#00f2fe]/10 hover:text-white transition-all text-slate-400 text-[10px] font-bold rounded-lg mt-1 border border-white/5 hover:border-[#00f2fe]/30"
                                    >
                                        핫 월렛 자산 공급
                                    </button>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>

                <div className="bg-[#0a1020]/45 border border-white/5 rounded-2xl p-6 flex flex-col gap-4">
                    <div className="text-sm font-extrabold text-white border-b border-white/5 pb-2 flex items-center gap-2">
                        <ArrowUpRight size={16} className="text-rose-400" />
                        <span>온체인 출금 모의 요청</span>
                    </div>
                    <div className="flex flex-col gap-3 text-xs font-semibold">
                        <div className="flex flex-col gap-1">
                            <label className="text-[10px] text-slate-400">사용자 UID</label>
                            <input 
                                type="number"
                                value={custodyWithdrawUserId}
                                onChange={(e) => setCustodyWithdrawUserId(e.target.value)}
                                placeholder="예: 1"
                                className="w-full p-2 bg-slate-950 border border-white/10 rounded-lg text-white font-mono outline-none focus:border-[#8a2be2]"
                            />
                        </div>
                        <div className="flex flex-col gap-1">
                            <label className="text-[10px] text-slate-400">출금 자산</label>
                            <select
                                value={custodyWithdrawCurrency}
                                onChange={(e) => setCustodyWithdrawCurrency(e.target.value)}
                                className="w-full p-2 bg-slate-950 border border-white/10 rounded-lg text-white font-bold outline-none focus:border-[#8a2be2]"
                            >
                                <option value="BTC">BTC</option>
                                <option value="ETH">ETH</option>
                                <option value="ADA">ADA</option>
                                <option value="JAF">JAF</option>
                            </select>
                        </div>
                        <div className="flex flex-col gap-1">
                            <label className="text-[10px] text-slate-400">출금 수량</label>
                            <input 
                                type="number"
                                value={custodyWithdrawAmount}
                                onChange={(e) => setCustodyWithdrawAmount(e.target.value)}
                                placeholder="0.0"
                                step="0.0001"
                                className="w-full p-2 bg-slate-950 border border-white/10 rounded-lg text-white font-mono outline-none focus:border-[#8a2be2]"
                            />
                        </div>
                        <div className="flex flex-col gap-1">
                            <label className="text-[10px] text-slate-400">수신 온체인 주소</label>
                            <input 
                                type="text"
                                value={custodyWithdrawAddress}
                                onChange={(e) => setCustodyWithdrawAddress(e.target.value)}
                                placeholder="0x... 또는 btc1..."
                                className="w-full p-2 bg-slate-950 border border-white/10 rounded-lg text-white font-mono outline-none focus:border-[#8a2be2]"
                            />
                        </div>
                        <button
                            onClick={async () => {
                                if (!custodyWithdrawUserId || !custodyWithdrawAmount || !custodyWithdrawAddress) {
                                    alert("모든 필드를 채워주세요.");
                                    return;
                                }
                                const success = await requestCryptoWithdrawal(
                                    Number(custodyWithdrawUserId),
                                    custodyWithdrawCurrency,
                                    Number(custodyWithdrawAmount),
                                    custodyWithdrawAddress
                                );
                                if (success) {
                                    alert("온체인 출금 요청이 정상 등록되어 승인 대기열에 추가되었습니다.");
                                    setCustodyWithdrawUserId('');
                                    setCustodyWithdrawAmount('');
                                    setCustodyWithdrawAddress('');
                                }
                            }}
                            className="w-full py-2 bg-gradient-to-r from-rose-600 to-rose-400 hover:scale-[1.01] transition-transform text-white text-xs font-bold rounded-lg mt-1 shadow-lg"
                        >
                            출금 요청 제출
                        </button>
                    </div>
                </div>
            </div>

            {/* 2. 출금 승인/반여 대기열 & 입금 컨펌 진행 상황 */}
            <div className="grid grid-cols-1 gap-6">
                {/* 출금 대기열 */}
                <div className="bg-[#0a1020]/45 border border-white/5 rounded-2xl p-6 flex flex-col gap-4">
                    <div className="text-sm font-extrabold text-white border-b border-white/5 pb-2 flex items-center justify-between">
                        <div className="flex items-center gap-2">
                            <ArrowUpRight size={16} className="text-rose-400" />
                            <span>출금 승인 및 반려 대기열</span>
                        </div>
                        <span className="text-[10px] text-slate-400 font-mono">대기 및 브로드캐스트 상태 목록</span>
                    </div>
                    <div className="overflow-x-auto min-h-[200px] max-h-[350px]">
                        <table className="w-full text-left text-xs">
                            <thead>
                                <tr className="border-b border-white/5 text-slate-400 font-bold">
                                    <th className="py-2.5">ID</th>
                                    <th>UID</th>
                                    <th>통화</th>
                                    <th>출금 수량</th>
                                    <th>수신 주소</th>
                                    <th>TXID (트랜잭션 해시)</th>
                                    <th>컨펌</th>
                                    <th>상태</th>
                                    <th className="text-right">액션</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-white/5 font-medium text-slate-300">
                                {cryptoWithdrawals.length === 0 ? (
                                    <tr>
                                        <td colSpan={9} className="py-8 text-center text-slate-500 font-semibold">대기 중인 출금 요청이 없습니다.</td>
                                    </tr>
                                ) : (
                                    cryptoWithdrawals.map((w: any) => (
                                        <tr key={w.withdrawalId} className="hover:bg-white/2 transition-colors">
                                            <td className="py-3 font-mono text-slate-500">{w.withdrawalId}</td>
                                            <td className="font-mono text-slate-400">{w.userId}</td>
                                            <td className="font-bold text-white">{w.currency}</td>
                                            <td className="font-mono text-white">{w.amount.toLocaleString(undefined, { maximumFractionDigits: 6 })}</td>
                                            <td className="font-mono text-slate-500 text-[10px] break-all max-w-[120px]" title={w.toAddress}>{w.toAddress?.slice(0, 10)}...</td>
                                            <td className="font-mono text-slate-500 text-[10px] break-all max-w-[120px]" title={w.txHash}>
                                                <div className="flex items-center gap-1.5">
                                                    <span>{w.txHash ? `${w.txHash.slice(0, 10)}...` : '-'}</span>
                                                    {w.txHash && w.txHash !== '-' && (
                                                        <button
                                                            onClick={() => handleViewTx(w.txHash)}
                                                            className="px-1.5 py-0.5 bg-[#8a2be2]/20 hover:bg-[#8a2be2]/40 text-[#c084fc] rounded text-[9px] font-bold transition-all border border-[#8a2be2]/30"
                                                        >
                                                            조회
                                                        </button>
                                                    )}
                                                </div>
                                            </td>
                                            <td className="font-mono text-slate-400">
                                                {w.status === 'BROADCASTED' ? `${w.confirmations} / ${w.currency === 'BTC' ? btcConfirmations : w.currency === 'ETH' || w.currency === 'JAF' ? ethConfirmations : adaConfirmations}` : '-'}
                                            </td>
                                            <td>
                                                {w.status === 'PENDING' && (
                                                    <span className="px-1.5 py-0.5 rounded text-[9px] font-bold bg-amber-500/10 border border-amber-500/20 text-amber-400">승인대기</span>
                                                )}
                                                {w.status === 'BROADCASTED' && (
                                                    <span className="px-1.5 py-0.5 rounded text-[9px] font-bold bg-[#00f2fe]/10 border border-[#00f2fe]/20 text-[#00f2fe] animate-pulse">브로드캐스트</span>
                                                )}
                                                {(w.status === 'COMPLETED' || w.status === 'SUCCESS') && (
                                                    <span className="px-1.5 py-0.5 rounded text-[9px] font-bold bg-emerald-500/10 border border-emerald-500/20 text-emerald-400">완료됨</span>
                                                )}
                                                {w.status === 'REJECTED' && (
                                                    <span className="px-1.5 py-0.5 rounded text-[9px] font-bold bg-rose-500/10 border border-rose-500/20 text-rose-400">반려됨</span>
                                                )}
                                            </td>
                                            <td className="text-right">
                                                {w.status === 'PENDING' ? (
                                                    <div className="flex justify-end gap-1.5">
                                                        <button
                                                            onClick={async () => {
                                                                if (confirm(`${w.withdrawalId}번 출금 요청을 승인하시겠습니까?`)) {
                                                                    await approveWithdrawal(w.withdrawalId);
                                                                }
                                                            }}
                                                            className="px-2 py-1 bg-emerald-600 hover:bg-emerald-500 text-white rounded text-[10px] font-bold transition-all"
                                                        >
                                                            승인
                                                        </button>
                                                        <button
                                                            onClick={async () => {
                                                                if (confirm(`${w.withdrawalId}번 출금 요청을 반려하시겠습니까?`)) {
                                                                    await rejectWithdrawal(w.withdrawalId);
                                                                }
                                                            }}
                                                            className="px-2 py-1 bg-rose-600 hover:bg-rose-500 text-white rounded text-[10px] font-bold transition-all"
                                                        >
                                                            반려
                                                        </button>
                                                    </div>
                                                ) : (
                                                    <span className="text-[10px] text-slate-500 font-bold">-</span>
                                                )}
                                            </td>
                                        </tr>
                                    ))
                                )}
                            </tbody>
                        </table>
                    </div>
                </div>

                {/* 온체인 입금 모니터링 (Simulated Deposits) */}
                <div className="bg-[#0a1020]/45 border border-white/5 rounded-2xl p-6 flex flex-col gap-4">
                    <div className="text-sm font-extrabold text-white border-b border-white/5 pb-2 flex items-center justify-between">
                        <div className="flex items-center gap-2">
                            <ArrowDownRight size={16} className="text-emerald-400" />
                            <span>실시간 온체인 입금 모니터링 (컨펌 단계)</span>
                            <button
                                onClick={handleTestJafDeposit}
                                className="ml-3 px-2 py-1 bg-emerald-600/20 hover:bg-emerald-600/40 text-emerald-400 rounded text-[9px] font-bold transition-all border border-emerald-500/30"
                            >
                                테스트 입금 발생 (JAF)
                            </button>
                        </div>
                        <span className="text-[10px] text-slate-400 font-mono">가상 블록체인 입금 감지</span>
                    </div>
                    {/* 실시간 가상 입금 생성 기능이 비활성화되었을 때 경고 배너 노출 */}
                    {!onChainDepositMonitoringEnabled && (
                        <div className="bg-rose-500/10 border border-rose-500/20 rounded-xl p-3 flex items-center gap-3 animate-fade-in">
                            <span className="w-2 h-2 rounded-full bg-rose-500 animate-pulse shadow-[0_0_8px_#f43f5e]" />
                            <span className="text-xs font-semibold text-rose-400">
                                실시간 온체인 JAF 자동 입금 시뮬레이션이 시스템 환경 설정에서 비활성화되었습니다. (수동 테스트 입금 발생 및 Ganache 블록체인의 실시간 입금 감지는 정상 작동합니다.)
                            </span>
                        </div>
                    )}
                    <div className="overflow-x-auto min-h-[200px] max-h-[350px]">
                        <table className="w-full text-left text-xs">
                            <thead>
                                <tr className="border-b border-white/5 text-slate-400 font-bold">
                                    <th className="py-2.5">TXID</th>
                                    <th>수신 주소</th>
                                    <th>통화</th>
                                    <th>수량</th>
                                    <th>진행 블록 컨펌 수</th>
                                    <th className="text-right">상태</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-white/5 font-medium text-slate-300">
                                {pendingDeposits.length === 0 ? (
                                    <tr>
                                        <td colSpan={6} className="py-8 text-center text-slate-500 font-semibold">대기 중이거나 진행 중인 입금 트랜잭션이 없습니다.</td>
                                    </tr>
                                ) : (
                                    pendingDeposits.map((d: any) => (
                                        <tr key={d.txHash} className="hover:bg-white/2 transition-colors">
                                            <td className="py-3 font-mono text-slate-500 text-[10px] break-all max-w-[120px]" title={d.txHash}>{d.txHash?.slice(0, 15)}...</td>
                                            <td className="font-mono text-slate-400 text-[10px] break-all max-w-[100px]" title={d.cryptoAddress}>{d.cryptoAddress?.slice(0, 10)}...</td>
                                            <td className="font-bold text-white">{d.currency}</td>
                                            <td className="font-mono text-white">{d.amount.toLocaleString(undefined, { maximumFractionDigits: 6 })}</td>
                                            <td className="font-mono">
                                                <span className="text-[#00f2fe] font-black">{d.confirmations}</span>
                                                <span className="text-slate-500 font-bold"> / {d.currency === 'BTC' ? btcConfirmations : d.currency === 'ETH' || d.currency === 'JAF' ? ethConfirmations : adaConfirmations}</span>
                                            </td>
                                            <td className="text-right">
                                                <span className="px-1.5 py-0.5 rounded text-[9px] font-bold bg-[#00f2fe]/10 border border-[#00f2fe]/20 text-[#00f2fe] animate-pulse">컨펌 진행 중</span>
                                            </td>
                                        </tr>
                                    ))
                                )}
                            </tbody>
                        </table>
                    </div>
                </div>
            </div>

            {/* 3. 사용자 온체인 주소 목록 */}
            <div className="bg-[#0a1020]/45 border border-white/5 rounded-2xl p-6 flex flex-col gap-4">
                <div className="text-sm font-extrabold text-white border-b border-white/5 pb-2 flex items-center gap-2">
                    <Users size={16} className="text-[#00f2fe]" />
                    <span>회원 온체인 입금 주소 데이터베이스</span>
                </div>
                <div className="overflow-x-auto max-h-[300px]">
                    <table className="w-full text-left text-xs">
                        <thead>
                            <tr className="border-b border-white/5 text-slate-400 font-bold">
                                <th className="py-2.5">UID</th>
                                <th>회원 이메일</th>
                                <th>구분</th>
                                <th>온체인 지갑 주소</th>
                                <th>주소 생성 일시</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-white/5 font-medium text-slate-300">
                            {userCryptoAddresses.length === 0 ? (
                                <tr>
                                    <td colSpan={5} className="py-8 text-center text-slate-500 font-semibold">발급된 온체인 주소가 없습니다.</td>
                                </tr>
                            ) : (
                                userCryptoAddresses.map((addr: any, index: number) => (
                                    <tr key={index} className="hover:bg-white/2 transition-colors">
                                        <td className="py-3 font-mono text-slate-400">{addr.userId}</td>
                                        <td className="text-white font-bold">{addr.userEmail}</td>
                                        <td className="font-bold text-[#00f2fe]">{addr.currency}</td>
                                        <td className="font-mono text-slate-300 break-all">{addr.address}</td>
                                        <td className="font-mono text-slate-500">{new Date(addr.createdAt).toLocaleString()}</td>
                                    </tr>
                                ))
                            )}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    );
};
