import React, { useState, useEffect } from 'react';
import { useExchangeStore } from '../../store/useExchangeStore';
import { ShieldAlert, ToggleLeft, ToggleRight, Save } from 'lucide-react';

export const SettingsTab: React.FC = () => {
    const {
        duplicateLoginBlockEnabled,
        onChainDepositMonitoringEnabled,
        walletSimulationEnabled,
        btcConfirmations,
        ethConfirmations,
        adaConfirmations,
        marketFeeRates,
        toggleDuplicateLoginBlock,
        toggleOnChainDepositMonitoring,
        toggleWalletSimulation,
        updateConfirmationsSettings,
        updateFeeSettings
    } = useExchangeStore();

    // 환경 설정 모의 스위치 로컬 상태
    const [mockPlaySound, setMockPlaySound] = useState(true);
    const [mockEmailAlert, setMockEmailAlert] = useState(false);
    const [mockMatchingEngineMode, setMockMatchingEngineMode] = useState<'FIFO' | 'LIFO'>('FIFO');
    const [mockMaintenanceMode, setMockMaintenanceMode] = useState(false);

    // Local configuration states
    const [btcInput, setBtcInput] = useState<number>(3);
    const [ethInput, setEthInput] = useState<number>(6);
    const [adaInput, setAdaInput] = useState<number>(10);

    const [feeInputs, setFeeInputs] = useState<Record<string, string>>({});

    // Sync settings on load or change
    useEffect(() => {
        setBtcInput(btcConfirmations);
        setEthInput(ethConfirmations);
        setAdaInput(adaConfirmations);
    }, [btcConfirmations, ethConfirmations, adaConfirmations]);

    useEffect(() => {
        const inputs: Record<string, string> = {};
        Object.entries(marketFeeRates).forEach(([symbol, rate]) => {
            inputs[symbol] = (rate * 100).toString();
        });
        setFeeInputs(inputs);
    }, [marketFeeRates]);

    const handleSaveConfirmations = async (e: React.FormEvent) => {
        e.preventDefault();
        await updateConfirmationsSettings(Number(btcInput), Number(ethInput), Number(adaInput));
        alert('블록체인 가상 컨펌 임계치 설정이 업데이트되었습니다.');
    };

    const handleSaveFees = async (e: React.FormEvent) => {
        e.preventDefault();
        const updatedRates: Record<string, number> = {};
        Object.entries(feeInputs).forEach(([symbol, val]) => {
            updatedRates[symbol] = Number(val) / 100.0;
        });
        await updateFeeSettings(updatedRates);
        alert('거래 수수료 설정이 성공적으로 저장되었습니다.');
    };

    return (
        <div className="tab-panel animate-fade-in flex flex-col gap-6">
            <div className="section-title text-xl font-black text-white flex items-center gap-2">
                <ShieldAlert size={20} className="text-[#8a2be2]" />
                <span>시스템 관리 및 정책 환경 설정 (System Settings)</span>
            </div>

            <div className="grid grid-cols-1 xl:grid-cols-2 gap-6 text-xs font-semibold">
                {/* 1. 어드민 보안 및 모니터링 정책 */}
                <div className="bg-[#0a1020]/45 border border-white/5 rounded-2xl p-6 flex flex-col gap-4">
                    <div className="text-sm font-extrabold text-white border-b border-white/5 pb-2">
                        보안 및 가상 모의 팩터 스위치 (Feature Flags)
                    </div>
                    <div className="flex flex-col gap-4">
                        {/* 이중 로그인 제어 */}
                        <div className="flex items-center justify-between p-3.5 bg-slate-900/40 border border-white/5 rounded-xl">
                            <div className="flex flex-col gap-1 pr-4">
                                <span className="text-white text-xs font-bold">어드민 중복 로그인 세션 제어</span>
                                <span className="text-[10px] text-slate-400">활성화 시 다른 기기/브라우저 로그인 시 이전 어드민 세션을 강제 만료시킵니다.</span>
                            </div>
                            <button onClick={() => toggleDuplicateLoginBlock(!duplicateLoginBlockEnabled)} className="text-slate-400 hover:text-white transition-colors">
                                {duplicateLoginBlockEnabled ? (
                                    <span className="text-[#00f2fe] flex items-center gap-1"><ToggleRight size={38} className="text-[#00f2fe]" /></span>
                                ) : (
                                    <span className="text-slate-500 flex items-center gap-1"><ToggleLeft size={38} className="text-slate-500" /></span>
                                )}
                            </button>
                        </div>

                        {/* 온체인 실시간 입금 루프 */}
                        <div className="flex items-center justify-between p-3.5 bg-slate-900/40 border border-white/5 rounded-xl">
                            <div className="flex flex-col gap-1 pr-4">
                                <span className="text-white text-xs font-bold">실시간 온체인 가상 입금 생성 활성화</span>
                                <span className="text-[10px] text-slate-400">백엔드의 JAF/BTC/ETH 입금 감지 데몬 시뮬레이터를 켜고 끕니다.</span>
                            </div>
                            <button onClick={() => toggleOnChainDepositMonitoring(!onChainDepositMonitoringEnabled)} className="text-slate-400 hover:text-white transition-colors">
                                {onChainDepositMonitoringEnabled ? (
                                    <span className="text-[#00f2fe] flex items-center gap-1"><ToggleRight size={38} className="text-[#00f2fe]" /></span>
                                ) : (
                                    <span className="text-slate-500 flex items-center gap-1"><ToggleLeft size={38} className="text-slate-500" /></span>
                                )}
                            </button>
                        </div>

                        {/* 회원가입 지갑 자동발급 */}
                        <div className="flex items-center justify-between p-3.5 bg-slate-900/40 border border-white/5 rounded-xl">
                            <div className="flex flex-col gap-1 pr-4">
                                <span className="text-white text-xs font-bold">신규 회원 등록 시 지갑 원장 자동 생성</span>
                                <span className="text-[10px] text-slate-400">신규 가입 유저 발생 시 KRW, BTC, ETH 등의 기본 지갑 원장을 즉시 생성합니다.</span>
                            </div>
                            <button onClick={() => toggleWalletSimulation(!walletSimulationEnabled)} className="text-slate-400 hover:text-white transition-colors">
                                {walletSimulationEnabled ? (
                                    <span className="text-[#00f2fe] flex items-center gap-1"><ToggleRight size={38} className="text-[#00f2fe]" /></span>
                                ) : (
                                    <span className="text-slate-500 flex items-center gap-1"><ToggleLeft size={38} className="text-slate-500" /></span>
                                )}
                            </button>
                        </div>

                        {/* 효과음 설정 */}
                        <div className="flex items-center justify-between p-3.5 bg-slate-900/40 border border-white/5 rounded-xl">
                            <div className="flex flex-col gap-1 pr-4">
                                <span className="text-white text-xs font-bold">실시간 체결 알림 효과음 재생</span>
                                <span className="text-[10px] text-slate-400">신규 거래 체결 시 브라우저 오디오 효과음 알림을 재생합니다.</span>
                            </div>
                            <button onClick={() => setMockPlaySound(!mockPlaySound)} className="text-slate-400 hover:text-white transition-colors">
                                {mockPlaySound ? (
                                    <span className="text-[#00f2fe] flex items-center gap-1"><ToggleRight size={38} className="text-[#00f2fe]" /></span>
                                ) : (
                                    <span className="text-slate-500 flex items-center gap-1"><ToggleLeft size={38} className="text-slate-500" /></span>
                                )}
                            </button>
                        </div>

                        {/* 이메일 알림 */}
                        <div className="flex items-center justify-between p-3.5 bg-slate-900/40 border border-white/5 rounded-xl">
                            <div className="flex flex-col gap-1 pr-4">
                                <span className="text-white text-xs font-bold">시스템 오류 및 이상 징후 이메일 긴급 전송</span>
                                <span className="text-[10px] text-slate-400">시스템 예외 발생 시 관리자 이메일 계정으로 오류 보고서를 발송합니다.</span>
                            </div>
                            <button onClick={() => setMockEmailAlert(!mockEmailAlert)} className="text-slate-400 hover:text-white transition-colors">
                                {mockEmailAlert ? (
                                    <span className="text-[#00f2fe] flex items-center gap-1"><ToggleRight size={38} className="text-[#00f2fe]" /></span>
                                ) : (
                                    <span className="text-slate-500 flex items-center gap-1"><ToggleLeft size={38} className="text-slate-500" /></span>
                                )}
                            </button>
                        </div>
                    </div>
                </div>

                {/* 2. 블록체인 가상 컨펌 임계치 */}
                <div className="bg-[#0a1020]/45 border border-white/5 rounded-2xl p-6 flex flex-col gap-4">
                    <div className="text-sm font-extrabold text-white border-b border-white/5 pb-2">
                        가상 블록체인 입금 컨펌 임계치 설정 (Confirmations)
                    </div>
                    <form onSubmit={handleSaveConfirmations} className="flex flex-col gap-4">
                        <div className="grid grid-cols-3 gap-3">
                            <div className="flex flex-col gap-1">
                                <label className="text-[10px] text-slate-400">BTC (비트코인)</label>
                                <input 
                                    type="number"
                                    value={btcInput}
                                    onChange={(e) => setBtcInput(Number(e.target.value))}
                                    className="p-2 bg-slate-950 border border-white/10 rounded-lg text-white text-xs font-mono outline-none focus:border-[#8a2be2]"
                                />
                            </div>
                            <div className="flex flex-col gap-1">
                                <label className="text-[10px] text-slate-400">ETH / JAF (이더리움)</label>
                                <input 
                                    type="number"
                                    value={ethInput}
                                    onChange={(e) => setEthInput(Number(e.target.value))}
                                    className="p-2 bg-slate-950 border border-white/10 rounded-lg text-white text-xs font-mono outline-none focus:border-[#8a2be2]"
                                />
                            </div>
                            <div className="flex flex-col gap-1">
                                <label className="text-[10px] text-slate-400">ADA (카르다노)</label>
                                <input 
                                    type="number"
                                    value={adaInput}
                                    onChange={(e) => setAdaInput(Number(e.target.value))}
                                    className="p-2 bg-slate-950 border border-white/10 rounded-lg text-white text-xs font-mono outline-none focus:border-[#8a2be2]"
                                />
                            </div>
                        </div>
                        <button
                            type="submit"
                            className="py-2.5 bg-gradient-to-r from-[#8a2be2] to-[#4b0082] hover:scale-[1.01] transition-transform text-white text-xs font-bold rounded-lg flex items-center justify-center gap-1.5 shadow-lg"
                        >
                            <Save size={14} />
                            <span>컨펌 임계치 저장</span>
                        </button>
                    </form>
                </div>

                {/* 3. 거래 수수료 설정 */}
                <div className="bg-[#0a1020]/45 border border-white/5 rounded-2xl p-6 flex flex-col gap-4">
                    <div className="text-sm font-extrabold text-white border-b border-white/5 pb-2">
                        마켓별 거래 수수료율 설정 (Fee Configuration)
                    </div>
                    <form onSubmit={handleSaveFees} className="flex flex-col gap-4">
                        <div className="grid grid-cols-2 gap-4">
                            {Object.keys(marketFeeRates).map((symbol) => (
                                <div key={symbol} className="flex flex-col gap-1">
                                    <label className="text-[10px] text-slate-400">{symbol} 수수료율 (%)</label>
                                    <input 
                                        type="number"
                                        step="0.001"
                                        value={feeInputs[symbol] || ''}
                                        onChange={(e) => setFeeInputs({
                                            ...feeInputs,
                                            [symbol]: e.target.value
                                        })}
                                        className="p-2 bg-slate-950 border border-white/10 rounded-lg text-white text-xs font-mono outline-none focus:border-[#8a2be2]"
                                    />
                                </div>
                            ))}
                        </div>
                        <button
                            type="submit"
                            className="py-2.5 bg-gradient-to-r from-[#8a2be2] to-[#4b0082] hover:scale-[1.01] transition-transform text-white text-xs font-bold rounded-lg flex items-center justify-center gap-1.5 shadow-lg"
                        >
                            <Save size={14} />
                            <span>수수료율 업데이트 저장</span>
                        </button>
                    </form>
                </div>

                {/* 4. 거래소 운영 모드 설정 */}
                <div className="bg-[#0a1020]/45 border border-white/5 rounded-2xl p-6 flex flex-col gap-4">
                    <div className="text-sm font-extrabold text-white border-b border-white/5 pb-2 flex items-center gap-2">
                        <ShieldAlert size={16} className="text-amber-500" />
                        <span>거래소 운영 정책 구성 (시뮬레이션)</span>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        {/* 매칭 규칙 선택 */}
                        <div className="p-4 bg-slate-900/40 border border-white/5 rounded-xl flex flex-col gap-2">
                            <div className="flex flex-col gap-1">
                                <span className="text-xs font-bold text-white">매칭 엔진 오더북 체결 규칙</span>
                                <span className="text-[10px] text-slate-400">거래 엔진의 매칭 우선순위 알고리즘을 선택합니다.</span>
                            </div>
                            <div className="flex gap-2 mt-2">
                                {(['FIFO', 'LIFO'] as const).map(mode => (
                                    <button
                                        key={mode}
                                        type="button"
                                        onClick={() => setMockMatchingEngineMode(mode)}
                                        className={`flex-1 py-2 rounded-lg text-xs font-bold transition-all border ${mockMatchingEngineMode === mode ? 'bg-amber-500/20 border-amber-500 text-amber-400' : 'bg-transparent border-white/10 text-slate-400 hover:text-white'}`}
                                    >
                                        {mode} (선입선출)
                                    </button>
                                ))}
                            </div>
                        </div>

                        {/* 유지보수 점검 모드 */}
                        <div className="p-4 bg-slate-900/40 border border-white/5 rounded-xl flex items-center justify-between">
                            <div className="flex flex-col gap-1 pr-2">
                                <span className="text-xs font-bold text-white">거래소 점검 모드 활성화</span>
                                <span className="text-[10px] text-slate-400">활성화 시 일반 유저의 주문 요청을 차단하고 접속을 제한합니다.</span>
                            </div>
                            <button 
                                type="button"
                                onClick={() => setMockMaintenanceMode(!mockMaintenanceMode)}
                                className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors duration-200 focus:outline-none ${mockMaintenanceMode ? 'bg-amber-500' : 'bg-slate-700'}`}
                            >
                                <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform duration-200 ${mockMaintenanceMode ? 'translate-x-6' : 'translate-x-1'}`} />
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};
