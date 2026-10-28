import React from 'react';

import { AppIcon as Icon } from 'components';

import { n } from '../../utils/helpers';

// ─── tab === 'mapa' ───
export default function TabMapa({ mapsEmbedUrl, mapsLinkUrl, romaneio, todasCidadesRota }) {
    return (
        <div className="flex flex-col gap-3">
                            {!romaneio.destino ? (
                                <div className="flex flex-col items-center justify-center py-12 gap-2" style={{ color:'var(--color-muted-foreground)' }}>
                                    <Icon name="MapPin" size={36} color="currentColor" />
                                    <p className="text-sm">Nenhum destino definido neste romaneio.</p>
                                </div>
                            ) : (
                                <>
                                    {/* Breadcrumb da rota */}
                                    <div className="flex items-center gap-1 flex-wrap">
                                        {todasCidadesRota.map((cidade, i) => (
                                            <React.Fragment key={i}>
                                                <div className="flex items-center gap-1">
                                                    <Icon name={i === 0 ? 'Home' : i === todasCidadesRota.length - 1 ? 'MapPin' : 'Circle'} size={13} color={i === 0 ? '#059669' : i === todasCidadesRota.length - 1 ? 'var(--color-primary)' : '#D97706'} />
                                                    <span className="text-xs font-medium" style={{ color: i === 0 ? '#059669' : i === todasCidadesRota.length - 1 ? 'var(--color-primary)' : '#D97706' }}>{cidade}</span>
                                                </div>
                                                {i < todasCidadesRota.length - 1 && <Icon name="ChevronRight" size={12} color="var(--color-muted-foreground)" />}
                                            </React.Fragment>
                                        ))}
                                        <a href={mapsLinkUrl} target="_blank" rel="noopener noreferrer"
                                            className="ml-auto flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-caption font-medium border hover:bg-blue-50 transition-colors flex-shrink-0"
                                            style={{ borderColor:'var(--color-border)', color:'var(--color-primary)' }}>
                                            <Icon name="ExternalLink" size={12} color="currentColor" />
                                            Abrir no Google Maps
                                        </a>
                                    </div>
                                    <div className="rounded-xl overflow-hidden border" style={{ borderColor:'var(--color-border)', height:320 }}>
                                        <iframe title="Rota no mapa" width="100%" height="100%"
                                            loading="lazy" referrerPolicy="no-referrer-when-downgrade"
                                            src={mapsEmbedUrl} style={{ border:0 }} />
                                    </div>
                                    {n(romaneio.distancia_km) > 0 && (
                                        <div className="flex items-center gap-2 text-xs font-caption" style={{ color:'var(--color-muted-foreground)' }}>
                                            <Icon name="Route" size={13} color="currentColor" />
                                            Distância (ida): <strong className="font-data">{(n(romaneio.distancia_km) / 2).toLocaleString('pt-BR', { maximumFractionDigits: 1 })} km</strong>
                                            <span className="mx-1">·</span>
                                            Total (ida+volta): <strong className="font-data">{romaneio.distancia_km} km</strong>
                                        </div>
                                    )}
                                </>
                            )}
                        </div>
    );
}
