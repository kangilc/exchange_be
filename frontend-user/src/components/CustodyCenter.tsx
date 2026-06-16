import React from 'react';

interface CustodyCenterProps {
    balances: { [key: string]: number };
    custodyCurrency: string;
    setCustodyCurrency: (c: string) => void;
    custodyAction: 'DEPOSIT' | 'WITHDRAW';
    setCustodyAction: (a: 'DEPOSIT' | 'WITHDRAW') => void;
    withdrawAddressInput: string;
    setWithdrawAddressInput: (a: string) => void;
    otpInput: string;
    setOtpInput: (o: string) => void;
    custodyAmountInput: string;
    setCustodyAmountInput: (a: string) => void;
    handleCustodySubmit: (e: React.FormEvent) => void;
    custodyHistory: any[];
}

export const CustodyCenter: React.FC<CustodyCenterProps> = React.memo(({
    balances,
    custodyCurrency,
    setCustodyCurrency,
    custodyAction,
    setCustodyAction,
    withdrawAddressInput,
    setWithdrawAddressInput,
    otpInput,
    setOtpInput,
    custodyAmountInput,
    setCustodyAmountInput,
    handleCustodySubmit,
    custodyHistory
}) => {
    return (
        <div className="grid grid-cols-1 xl:grid-cols-3 gap-6 items-start animate-fade-in text-xs font-semibold">
            {/* 좌측 2개열: 자산 카드 리스트 & 입출금 폼 */}
            <div className="xl:col-span-2 flex flex-col gap-6">
                {/* 자산 현황 카드 목록 */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                    {['KRW', 'USD', 'BTC', 'ADA'].map((cur) => (
                        <div
                            key={cur}
                            onClick={() => setCustodyCurrency(cur)}
                            className={`p-4 border rounded-2xl cursor-pointer transition-all flex flex-col gap-2 ${custodyCurrency === cur ? 'bg-[#8a2be2]/15 border-[#8a2be2] shadow-lg shadow-[#8a2be2]/10' : 'bg-[#0a1020]/45 border-white/5 hover:border-white/10'}`}
                        >
                            <span className="text-[10px] text-slate-400 font-extrabold uppercase">{cur === 'KRW' ? '원화 (KRW)' : cur === 'USD' ? '달러 (USD)' : cur === 'BTC' ? '비트코인 (BTC)' : '에이다 (ADA)'}</span>
                            <span className={`text-base font-black font-mono ${cur === 'BTC' ? 'text-[#00f2fe]' : cur === 'ADA' ? 'text-[#c084fc]' : 'text-white'}`}>
                                {balances[cur].toLocaleString(undefined, { minimumFractionDigits: cur === 'KRW' ? 0 : cur === 'USD' ? 2 : 6 })}
                            </span>
                        </div>
                    ))}
                </div>

                {/* 입출금 신청 입력 카드 */}
                <div className="bg-[#0a1020]/45 border border-white/5 rounded-2xl p-6 flex flex-col gap-5">
                    <div className="border-b border-white/5 pb-3 flex justify-between items-center">
                        <span className="text-sm font-extrabold text-white uppercase">{custodyCurrency} 입출금 신청서</span>
                        <div className="flex bg-white/2 border border-white/5 rounded-xl p-0.5 text-[10px] font-bold">
                            <button
                                type="button"
                                onClick={() => setCustodyAction('DEPOSIT')}
                                className={`px-4 py-1.5 rounded-lg transition-all ${custodyAction === 'DEPOSIT' ? 'bg-emerald-500 text-white' : 'text-slate-400'}`}
                            >
                                입금 (Deposit)
                            </button>
                            <button
                                type="button"
                                onClick={() => setCustodyAction('WITHDRAW')}
                                className={`px-4 py-1.5 rounded-lg transition-all ${custodyAction === 'WITHDRAW' ? 'bg-rose-500 text-white' : 'text-slate-400'}`}
                            >
                                출금 (Withdraw)
                            </button>
                        </div>
                    </div>

                    <form onSubmit={handleCustodySubmit} className="flex flex-col gap-4">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            {/* 입금용 정보 피드백 */}
                            {custodyAction === 'DEPOSIT' ? (
                                <div className="bg-white/2 border border-white/5 rounded-xl p-4 flex flex-col gap-3 justify-center md:col-span-2">
                                    <span className="text-[10px] text-slate-400 uppercase tracking-wider font-extrabold">아래 가상 주소(계좌)로 이체(입금) 시 1초 내 자동 정산됩니다.</span>
                                    <div className="flex items-center justify-between font-mono bg-black/40 p-3 rounded-lg border border-white/5 mt-1">
                                        <span className="text-white font-bold text-xs select-all">
                                            {custodyCurrency === 'KRW' ? '우리은행 1002-887-123456 (가상계좌)' : custodyCurrency === 'USD' ? 'CITIBANK 9982-111-9988 (가상계좌)' : custodyCurrency === 'BTC' ? '1BTC_DEPOSIT_ADDR_USER1_XXXXXXXXX' : 'addr1_ADA_DEPOSIT_ADDR_USER1_XXXX'}
                                        </span>
                                        <span className="text-[10px] text-emerald-400 font-extrabold border border-emerald-500/25 px-1.5 py-0.5 rounded uppercase">COPY</span>
                                    </div>
                                </div>
                            ) : (
                                <>
                                    {/* 출금 대상 주소 */}
                                    <div className="flex flex-col gap-1.5">
                                        <label className="text-slate-400 uppercase text-[10px]">출금 대상 주소 (계좌번호)</label>
                                        <input
                                            type="text"
                                            value={withdrawAddressInput}
                                            onChange={(e) => setWithdrawAddressInput(e.target.value)}
                                            placeholder="수령인의 정확한 주소를 입력해 주세요."
                                            className="w-full p-3 bg-black/30 border border-white/10 rounded-lg text-white font-bold outline-none focus:border-[#8a2be2]"
                                        />
                                    </div>
                                    {/* 구글 OTP 인증 */}
                                    <div className="flex flex-col gap-1.5">
                                        <label className="text-slate-400 uppercase text-[10px] text-rose-400">구글 2FA OTP 보안인증 (6자리)</label>
                                        <input
                                            type="text"
                                            maxLength={6}
                                            value={otpInput}
                                            onChange={(e) => setOtpInput(e.target.value.replace(/[^0-9]/g, ''))}
                                            placeholder="OTP 번호 6자리를 입력해주세요."
                                            className="w-full p-3 bg-black/30 border border-rose-500/30 rounded-lg text-white font-mono text-center font-bold outline-none focus:border-rose-500"
                                        />
                                    </div>
                                </>
                            )}

                            {/* 신청 금액 */}
                            <div className="flex flex-col gap-1.5 md:col-span-2">
                                <div className="flex justify-between items-center text-[10px]">
                                    <label className="text-slate-400 uppercase">신청 수량 / 금액</label>
                                    <span className="text-slate-400">
                                        가용 잔고: {balances[custodyCurrency].toLocaleString()} {custodyCurrency}
                                    </span>
                                </div>
                                <div className="relative flex items-center">
                                    <input
                                        type="number"
                                        step="any"
                                        required
                                        value={custodyAmountInput}
                                        onChange={(e) => setCustodyAmountInput(e.target.value)}
                                        placeholder="신청할 수량을 입력해주세요."
                                        className="w-full p-3 bg-black/30 border border-white/10 rounded-lg text-white font-bold outline-none focus:border-[#8a2be2]"
                                    />
                                    <span className="absolute right-4 text-slate-400 font-bold">{custodyCurrency}</span>
                                </div>
                            </div>
                        </div>

                        <button
                            type="submit"
                            className={`w-full py-3.5 rounded-xl font-extrabold text-white text-sm shadow-xl transition-all hover:scale-[1.01] mt-2 ${custodyAction === 'DEPOSIT' ? 'bg-gradient-to-r from-emerald-600 to-emerald-400' : 'bg-gradient-to-r from-rose-600 to-rose-400'}`}
                        >
                            {custodyAction === 'DEPOSIT' ? '입금 승인 완료 처리' : '출금 자산 안전 승인'}
                        </button>
                    </form>
                </div>
            </div>

            {/* 우측 1개열: 최근 입출금 변동 이력 타임라인 */}
            <div className="bg-[#0a1020]/45 border border-white/5 rounded-2xl p-5 flex flex-col gap-4 h-[calc(100vh-270px)] min-h-[500px]">
                <span className="text-sm font-extrabold text-white border-b border-white/5 pb-2">최근 입출금 내역 (원장 이력)</span>
                <div className="flex-1 overflow-y-auto flex flex-col gap-3 min-h-0">
                    {custodyHistory.length === 0 ? (
                        <span className="text-slate-500 py-12 text-center">기록된 원장 이력이 없습니다.</span>
                    ) : (
                        custodyHistory.map((item, idx) => (
                            <div key={idx} className="bg-slate-950/40 border border-white/5 p-3.5 rounded-xl flex flex-col gap-2 font-mono text-[10px]">
                                <div className="flex justify-between items-center">
                                    <span className="text-slate-500">{item.time}</span>
                                    <span className={`px-2 py-0.5 rounded font-extrabold text-[8px] border uppercase ${item.type === 'DEPOSIT' ? 'bg-emerald-500/10 border-emerald-500/35 text-emerald-400' : 'bg-rose-500/10 border-rose-500/35 text-rose-400'}`}>
                                        {item.type}
                                    </span>
                                </div>
                                <div className="flex justify-between items-center text-xs">
                                    <span className="text-white font-bold">{item.amount.toLocaleString()} {item.currency}</span>
                                    <span className="text-emerald-400 font-extrabold">완료</span>
                                </div>
                            </div>
                        ))
                    )}
                </div>
            </div>
        </div>
    );
});
