import React from "react";
import Icon from "components/AppIcon";

const MetricsCards = ({ metrics }) => {
    return (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 md:gap-6">
            {metrics?.map((metric) => (
                <div
                    key={metric?.id}
                    className="bg-white rounded-lg border border-slate-200 p-4 md:p-5 shadow-card flex flex-col gap-2"
                >
                    <div className="flex items-center justify-between">
                        <span className="text-xs md:text-sm font-caption text-gray-500 uppercase tracking-wide">
                            {metric?.label}
                        </span>
                        <div
                            className="flex items-center justify-center rounded-md w-8 h-8"
                            style={{ backgroundColor: metric?.bgColor }}
                        >
                            <Icon name={metric?.icon} size={16} color={metric?.iconColor} strokeWidth={2} />
                        </div>
                    </div>
                    <div className="flex items-end gap-2">
                        <span className="text-2xl md:text-3xl font-heading font-bold" style={{ color: "var(--color-primary)" }}>
                            {metric?.value}
                        </span>
                        {metric?.unit && (
                            <span className="text-sm text-gray-500 mb-1">{metric?.unit}</span>
                        )}
                    </div>
                    <div className="flex items-center gap-1">
                        <Icon
                            name={metric?.trend === "up" ? "TrendingUp" : metric?.trend === "down" ? "TrendingDown" : "Minus"}
                            size={13}
                            color={metric?.trend === "up" ? "#059669" : metric?.trend === "down" ? "#DC2626" : "#6B7280"}
                            strokeWidth={2}
                        />
                        <span
                            className="text-xs font-caption"
                            style={{
                                color: metric?.trend === "up" ? "#059669" : metric?.trend === "down" ? "#DC2626" : "#6B7280",
                            }}
                        >
                            {metric?.trendLabel}
                        </span>
                    </div>
                </div>
            ))}
        </div>
    );
};

export default MetricsCards;