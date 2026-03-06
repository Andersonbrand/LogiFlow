import React, { useState, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import Icon from "components/AppIcon";
import StatusBadge from "./StatusBadge";

const RomaneiosTable = ({ romaneios }) => {
    const [search, setSearch] = useState("");
    const [sortKey, setSortKey] = useState("numero");
    const [sortDir, setSortDir] = useState("asc");
    const [expandedRow, setExpandedRow] = useState(null);
    const navigate = useNavigate();

    const columns = [
        { key: "numero", label: "Nº Romaneio" },
        { key: "motorista", label: "Motorista" },
        { key: "placa", label: "Placa" },
        { key: "destino", label: "Destino" },
        { key: "status", label: "Status" },
        { key: "pesoTotal", label: "Peso Total (kg)" },
        { key: "saida", label: "Saída" },
    ];

    const handleSort = (key) => {
        if (sortKey === key) {
            setSortDir((d) => (d === "asc" ? "desc" : "asc"));
        } else {
            setSortKey(key);
            setSortDir("asc");
        }
    };

    const filtered = useMemo(() => {
        const q = search?.toLowerCase();
        return romaneios?.filter(
            (r) =>
                r?.numero?.toLowerCase()?.includes(q) ||
                r?.motorista?.toLowerCase()?.includes(q) ||
                r?.placa?.toLowerCase()?.includes(q) ||
                r?.destino?.toLowerCase()?.includes(q) ||
                r?.status?.toLowerCase()?.includes(q)
        );
    }, [romaneios, search]);

    const sorted = useMemo(() => {
        return [...filtered]?.sort((a, b) => {
            const av = a?.[sortKey];
            const bv = b?.[sortKey];
            if (typeof av === "number" && typeof bv === "number") {
                return sortDir === "asc" ? av - bv : bv - av;
            }
            return sortDir === "asc" ? String(av)?.localeCompare(String(bv), "pt-BR")
                : String(bv)?.localeCompare(String(av), "pt-BR");
        });
    }, [filtered, sortKey, sortDir]);

    return (
        <div className="bg-white rounded-lg border border-slate-200 shadow-card overflow-hidden">
            {/* Table Header */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 px-4 md:px-6 py-4 border-b border-slate-200"
                style={{ backgroundColor: "#404040" }}>
                <h2 className="text-base md:text-lg font-heading font-semibold text-white">
                    Romaneios Ativos
                </h2>
                <div className="relative">
                    <Icon
                        name="Search"
                        size={15}
                        color="#9CA3AF"
                        strokeWidth={2}
                        className="absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none"
                    />
                    <input
                        type="text"
                        placeholder="Buscar romaneio..."
                        value={search}
                        onChange={(e) => setSearch(e?.target?.value)}
                        className="pl-9 pr-4 py-2 text-sm rounded-md border border-slate-600 bg-slate-700 text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-400 w-full sm:w-56"
                    />
                </div>
            </div>
            {/* Desktop Table */}
            <div className="hidden md:block overflow-x-auto">
                <table className="w-full text-sm">
                    <thead>
                        <tr style={{ backgroundColor: "#595959" }}>
                            {columns?.map((col) => (
                                <th
                                    key={col?.key}
                                    className="px-4 py-3 text-left text-xs font-caption font-semibold text-white uppercase tracking-wider cursor-pointer select-none whitespace-nowrap"
                                    onClick={() => handleSort(col?.key)}
                                >
                                    <div className="flex items-center gap-1">
                                        {col?.label}
                                        <Icon
                                            name={
                                                sortKey === col?.key
                                                    ? sortDir === "asc" ? "ChevronUp" : "ChevronDown" : "ChevronsUpDown"
                                            }
                                            size={13}
                                            color="#CBD5E1"
                                            strokeWidth={2}
                                        />
                                    </div>
                                </th>
                            ))}
                            <th className="px-4 py-3 text-left text-xs font-caption font-semibold text-white uppercase tracking-wider">
                                Ações
                            </th>
                        </tr>
                    </thead>
                    <tbody>
                        {sorted?.length === 0 ? (
                            <tr>
                                <td colSpan={columns?.length + 1} className="text-center py-10 text-gray-400 text-sm">
                                    Nenhum romaneio encontrado.
                                </td>
                            </tr>
                        ) : (
                            sorted?.map((row, idx) => (
                                <tr
                                    key={row?.id}
                                    className="border-b border-slate-100 transition-colors duration-150 hover:bg-blue-50"
                                    style={{ backgroundColor: idx % 2 === 0 ? "#FFFFFF" : "#F8FAFC" }}
                                >
                                    <td className="px-4 py-3 font-data font-medium text-blue-700 whitespace-nowrap">{row?.numero}</td>
                                    <td className="px-4 py-3 text-gray-700 whitespace-nowrap">{row?.motorista}</td>
                                    <td className="px-4 py-3 font-data text-gray-600 whitespace-nowrap">{row?.placa}</td>
                                    <td className="px-4 py-3 text-gray-700 whitespace-nowrap">{row?.destino}</td>
                                    <td className="px-4 py-3 whitespace-nowrap">
                                        <StatusBadge status={row?.status} />
                                    </td>
                                    <td className="px-4 py-3 font-data text-gray-700 whitespace-nowrap">
                                        {row?.pesoTotal?.toLocaleString("pt-BR")} kg
                                    </td>
                                    <td className="px-4 py-3 text-gray-500 whitespace-nowrap">{row?.saida}</td>
                                    <td className="px-4 py-3 whitespace-nowrap">
                                        <div className="flex items-center gap-2">
                                            <button
                                                className="p-1.5 rounded hover:bg-blue-100 transition-colors"
                                                title="Ver detalhes"
                                                aria-label="Ver detalhes do romaneio"
                                                onClick={() => navigate("/romaneios")}
                                            >
                                                <Icon name="Eye" size={15} color="#1E3A5F" strokeWidth={2} />
                                            </button>
                                            <button
                                                className="p-1.5 rounded hover:bg-amber-100 transition-colors"
                                                title="Editar"
                                                aria-label="Editar romaneio"
                                                onClick={() => navigate("/romaneios")}
                                            >
                                                <Icon name="Pencil" size={15} color="#D97706" strokeWidth={2} />
                                            </button>
                                        </div>
                                    </td>
                                </tr>
                            ))
                        )}
                    </tbody>
                </table>
            </div>
            {/* Mobile Card View */}
            <div className="md:hidden divide-y divide-slate-100">
                {sorted?.length === 0 ? (
                    <div className="text-center py-10 text-gray-400 text-sm">Nenhum romaneio encontrado.</div>
                ) : (
                    sorted?.map((row) => (
                        <div key={row?.id} className="p-4">
                            <div
                                className="flex items-center justify-between cursor-pointer"
                                onClick={() => setExpandedRow(expandedRow === row?.id ? null : row?.id)}
                            >
                                <div className="flex items-center gap-3 min-w-0">
                                    <span className="font-data font-semibold text-blue-700 text-sm flex-shrink-0">{row?.numero}</span>
                                    <StatusBadge status={row?.status} />
                                </div>
                                <Icon
                                    name={expandedRow === row?.id ? "ChevronUp" : "ChevronDown"}
                                    size={16}
                                    color="#6B7280"
                                    strokeWidth={2}
                                />
                            </div>
                            {expandedRow === row?.id && (
                                <div className="mt-3 grid grid-cols-2 gap-2 text-sm">
                                    <div>
                                        <span className="text-gray-400 text-xs">Motorista</span>
                                        <p className="text-gray-700 font-medium">{row?.motorista}</p>
                                    </div>
                                    <div>
                                        <span className="text-gray-400 text-xs">Placa</span>
                                        <p className="font-data text-gray-700">{row?.placa}</p>
                                    </div>
                                    <div>
                                        <span className="text-gray-400 text-xs">Destino</span>
                                        <p className="text-gray-700">{row?.destino}</p>
                                    </div>
                                    <div>
                                        <span className="text-gray-400 text-xs">Peso Total</span>
                                        <p className="font-data text-gray-700">{row?.pesoTotal?.toLocaleString("pt-BR")} kg</p>
                                    </div>
                                    <div>
                                        <span className="text-gray-400 text-xs">Saída</span>
                                        <p className="text-gray-700">{row?.saida}</p>
                                    </div>
                                    <div className="flex items-center gap-2 pt-1">
                                        <button className="p-1.5 rounded hover:bg-blue-100 transition-colors" title="Ver detalhes" onClick={() => navigate("/romaneios")}>
                                            <Icon name="Eye" size={15} color="#1E3A5F" strokeWidth={2} />
                                        </button>
                                        <button className="p-1.5 rounded hover:bg-amber-100 transition-colors" title="Editar" onClick={() => navigate("/romaneios")}>
                                            <Icon name="Pencil" size={15} color="#D97706" strokeWidth={2} />
                                        </button>
                                    </div>
                                </div>
                            )}
                        </div>
                    ))
                )}
            </div>
            <div className="px-4 md:px-6 py-3 border-t border-slate-100 flex items-center justify-between">
                <span className="text-xs text-gray-400 font-caption">
                    {sorted?.length} de {romaneios?.length} romaneios
                </span>
                <div className="flex items-center gap-1">
                    <button className="p-1.5 rounded hover:bg-slate-100 transition-colors" aria-label="Página anterior">
                        <Icon name="ChevronLeft" size={15} color="#6B7280" strokeWidth={2} />
                    </button>
                    <span className="text-xs text-gray-500 px-2">1 / 1</span>
                    <button className="p-1.5 rounded hover:bg-slate-100 transition-colors" aria-label="Próxima página">
                        <Icon name="ChevronRight" size={15} color="#6B7280" strokeWidth={2} />
                    </button>
                </div>
            </div>
        </div>
    );
};

export default RomaneiosTable;