import React from "react";
import Icon from "components/AppIcon";

const ACTIVITY_ICON = {
    criado: { icon: "FilePlus", color: "#059669", bg: "#D1FAE5" },
    atualizado: { icon: "RefreshCw", color: "#D97706", bg: "#FEF9C3" },
    finalizado: { icon: "CheckCircle2", color: "#1E3A5F", bg: "#DBEAFE" },
    alerta: { icon: "AlertTriangle", color: "#DC2626", bg: "#FEE2E2" },
};

const RecentActivityFeed = ({ activities }) => {
    return (
        <div className="bg-white rounded-lg border border-slate-200 shadow-card overflow-hidden">
            <div
                className="px-4 md:px-6 py-4 border-b border-slate-200"
                style={{ backgroundColor: "#404040" }}
            >
                <h2 className="text-base md:text-lg font-heading font-semibold text-white">
                    Atividade Recente
                </h2>
            </div>
            <div className="divide-y divide-slate-100">
                {activities?.map((act) => {
                    const cfg = ACTIVITY_ICON?.[act?.type] || ACTIVITY_ICON?.["atualizado"];
                    return (
                        <div key={act?.id} className="flex items-start gap-3 px-4 md:px-5 py-3">
                            <div
                                className="flex-shrink-0 flex items-center justify-center w-8 h-8 rounded-full mt-0.5"
                                style={{ backgroundColor: cfg?.bg }}
                            >
                                <Icon name={cfg?.icon} size={14} color={cfg?.color} strokeWidth={2} />
                            </div>
                            <div className="flex-1 min-w-0">
                                <p className="text-sm text-gray-700 line-clamp-2">{act?.message}</p>
                                <p className="text-xs text-gray-400 font-caption mt-0.5">{act?.time}</p>
                            </div>
                        </div>
                    );
                })}
            </div>
        </div>
    );
};

export default RecentActivityFeed;