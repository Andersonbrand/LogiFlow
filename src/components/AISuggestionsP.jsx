import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import Icon from "components/AppIcon";

const PRIORITY_CONFIG = {
    alta: { bg: "#FEE2E2", text: "#991B1B", border: "#FECACA", icon: "AlertTriangle", iconColor: "#DC2626" },
    media: { bg: "#FEF9C3", text: "#92400E", border: "#FDE68A", icon: "Info", iconColor: "#D97706" },
    baixa: { bg: "#D1FAE5", text: "#065F46", border: "#A7F3D0", icon: "Lightbulb", iconColor: "#059669" },
};

const AISuggestionsPanel = ({ suggestions }) => {
    const [dismissed, setDismissed] = useState([]);
    const navigate = useNavigate();

    const visible = suggestions?.filter((s) => !dismissed?.includes(s?.id));

    return (
        <div className="bg-white rounded-lg border border-slate-200 shadow-card overflow-hidden">
            <div
                className="flex items-center gap-3 px-4 md:px-6 py-4 border-b border-slate-200"
                style={{ backgroundColor: "#404040" }}
            >
                <div className="flex items-center justify-center w-7 h-7 rounded-md bg-blue-500">
                    <Icon name="Sparkles" size={15} color="#FFFFFF" strokeWidth={2} />
                </div>
                <h2 className="text-base md:text-lg font-heading font-semibold text-white flex-1">
                    Sugestões da IA
                </h2>
                <span className="text-xs font-caption bg-blue-500 text-white px-2 py-0.5 rounded-full">
                    {visible?.length} ativas
                </span>
            </div>
            <div className="p-4 md:p-5 flex flex-col gap-3">
                {visible?.length === 0 ? (
                    <div className="flex flex-col items-center py-6 gap-2 text-gray-400">
                        <Icon name="CheckCircle2" size={32} color="#059669" strokeWidth={1.5} />
                        <p className="text-sm">Todas as sugestões foram tratadas.</p>
                    </div>
                ) : (
                    visible?.map((s) => {
                        const cfg = PRIORITY_CONFIG?.[s?.priority] || PRIORITY_CONFIG?.["baixa"];
                        return (
                            <div
                                key={s?.id}
                                className="flex items-start gap-3 p-3 rounded-lg border"
                                style={{ backgroundColor: cfg?.bg, borderColor: cfg?.border }}
                            >
                                <div className="flex-shrink-0 mt-0.5">
                                    <Icon name={cfg?.icon} size={16} color={cfg?.iconColor} strokeWidth={2} />
                                </div>
                                <div className="flex-1 min-w-0">
                                    <p className="text-sm font-medium" style={{ color: cfg?.text }}>
                                        {s?.title}
                                    </p>
                                    <p className="text-xs mt-0.5" style={{ color: cfg?.text, opacity: 0.8 }}>
                                        {s?.description}
                                    </p>
                                    <div className="flex items-center gap-2 mt-2">
                                        <button
                                            className="text-xs font-caption font-semibold underline underline-offset-2 transition-opacity hover:opacity-70"
                                            style={{ color: cfg?.text }}
                                            onClick={() => navigate("/romaneios")}
                                        >
                                            {s?.action}
                                        </button>
                                        <span style={{ color: cfg?.text, opacity: 0.4 }}>·</span>
                                        <span className="text-xs font-caption" style={{ color: cfg?.text, opacity: 0.6 }}>
                                            Economia estimada: {s?.saving}
                                        </span>
                                    </div>
                                </div>
                                <button
                                    className="flex-shrink-0 p-1 rounded hover:bg-black/10 transition-colors"
                                    aria-label="Dispensar sugestão"
                                    onClick={() => setDismissed((prev) => [...prev, s?.id])}
                                >
                                    <Icon name="X" size={13} color={cfg?.text} strokeWidth={2} />
                                </button>
                            </div>
                        );
                    })
                )}
            </div>
        </div>
    );
};

export default AISuggestionsPanel;