import React, { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { supabase } from 'utils/supabaseClient';
import Icon from 'components/AppIcon';

/**
 * Página de confirmação de e-mail.
 * Supabase redireciona para cá após o usuário clicar no link de confirmação.
 * Lida com: confirmação de novo e-mail, troca de e-mail (duas etapas), magic link.
 */
export default function EmailConfirmado() {
    const navigate = useNavigate();
    const [searchParams] = useSearchParams();
    const [status, setStatus] = useState('loading'); // loading | success | error
    const [message, setMessage] = useState('');
    const [subMessage, setSubMessage] = useState('');

    useEffect(() => {
        async function handleConfirmation() {
            try {
                // Supabase pode enviar token_hash + type na URL
                const tokenHash = searchParams.get('token_hash');
                const type = searchParams.get('type');
                const code = searchParams.get('code');
                const errorParam = searchParams.get('error');
                const errorDescription = searchParams.get('error_description');
                const msgParam = searchParams.get('message') || '';

                // Erro explícito na URL
                if (errorParam) {
                    setStatus('error');
                    setMessage('Link inválido ou expirado');
                    setSubMessage(errorDescription || 'O link de confirmação expirou ou já foi utilizado. Solicite um novo.');
                    return;
                }

                // Primeiro link da troca de e-mail confirmado (aguarda o segundo)
                if (msgParam.toLowerCase().includes('confirmation link accepted')) {
                    setStatus('success');
                    setMessage('Primeiro e-mail confirmado!');
                    setSubMessage('Agora verifique a caixa de entrada do novo endereço de e-mail e clique no link de confirmação enviado para ele.');
                    return;
                }

                // Segundo link ou troca completa via code
                if (code) {
                    const { error } = await supabase.auth.exchangeCodeForSession(code);
                    if (error) throw error;
                    setStatus('success');
                    setMessage('E-mail alterado com sucesso!');
                    setSubMessage('Seu endereço de e-mail foi atualizado. Use o novo e-mail para entrar na próxima vez.');
                    return;
                }

                // Confirmação via token_hash (signup, email change, recovery)
                if (tokenHash && type) {
                    const { error } = await supabase.auth.verifyOtp({ token_hash: tokenHash, type });
                    if (error) throw error;

                    if (type === 'email_change') {
                        setStatus('success');
                        setMessage('E-mail confirmado!');
                        setSubMessage('Seu endereço de e-mail foi atualizado com sucesso.');
                    } else if (type === 'signup') {
                        setStatus('success');
                        setMessage('Conta confirmada!');
                        setSubMessage('Seu e-mail foi verificado. Você já pode acessar o sistema.');
                    } else if (type === 'recovery') {
                        // Redireciona para redefinir senha
                        navigate('/reset-password');
                        return;
                    } else {
                        setStatus('success');
                        setMessage('Confirmação realizada!');
                        setSubMessage('Sua solicitação foi confirmada com sucesso.');
                    }
                    return;
                }

                // Hash fragment (#access_token=...) — fluxo implícito
                const hash = window.location.hash;
                if (hash.includes('access_token')) {
                    const { data: { session }, error } = await supabase.auth.getSession();
                    if (error) throw error;
                    if (session) {
                        setStatus('success');
                        setMessage('Acesso confirmado!');
                        setSubMessage('Você foi autenticado com sucesso.');
                        return;
                    }
                }

                // Sem parâmetros reconhecidos — provavelmente já foi processado
                setStatus('success');
                setMessage('Confirmação recebida!');
                setSubMessage('Sua solicitação foi processada. Você pode fechar esta aba ou voltar ao sistema.');

            } catch (e) {
                setStatus('error');
                setMessage('Erro na confirmação');
                setSubMessage(e.message || 'Ocorreu um erro ao processar o link. Tente novamente ou solicite um novo link.');
            }
        }

        handleConfirmation();
    }, []); // eslint-disable-line

    const isLoading = status === 'loading';
    const isSuccess = status === 'success';

    return (
        <div className="min-h-screen flex items-center justify-center px-4"
            style={{ backgroundColor: 'var(--color-background, #F8FAFC)' }}>
            <div className="w-full max-w-md">
                {/* Card */}
                <div className="rounded-2xl border shadow-lg overflow-hidden"
                    style={{ backgroundColor: '#fff', borderColor: '#E2E8F0' }}>

                    {/* Top color bar */}
                    <div className="h-1.5 w-full"
                        style={{ backgroundColor: isLoading ? '#94A3B8' : isSuccess ? '#16A34A' : '#DC2626' }} />

                    <div className="p-8 flex flex-col items-center text-center">
                        {/* Icon */}
                        <div className="w-20 h-20 rounded-2xl flex items-center justify-center mb-5"
                            style={{
                                backgroundColor: isLoading ? '#F1F5F9' : isSuccess ? '#F0FDF4' : '#FEF2F2',
                            }}>
                            {isLoading ? (
                                <div className="w-8 h-8 rounded-full border-4 animate-spin"
                                    style={{ borderColor: '#94A3B8', borderTopColor: 'transparent' }} />
                            ) : isSuccess ? (
                                <Icon name="CheckCircle2" size={40} color="#16A34A" />
                            ) : (
                                <Icon name="XCircle" size={40} color="#DC2626" />
                            )}
                        </div>

                        {/* Logo */}
                        <div className="flex items-center gap-2 mb-6">
                            <div className="w-7 h-7 rounded-lg flex items-center justify-center"
                                style={{ backgroundColor: '#1E3A5F' }}>
                                <Icon name="Truck" size={14} color="#fff" />
                            </div>
                            <span className="font-bold text-sm" style={{ color: '#1E3A5F' }}>LogiFlow</span>
                        </div>

                        {isLoading ? (
                            <>
                                <h1 className="font-bold text-xl mb-2" style={{ color: '#0F172A' }}>
                                    Verificando...
                                </h1>
                                <p className="text-sm" style={{ color: '#64748B' }}>
                                    Aguarde enquanto processamos sua confirmação.
                                </p>
                            </>
                        ) : (
                            <>
                                <h1 className="font-bold text-xl mb-2" style={{ color: '#0F172A' }}>
                                    {message}
                                </h1>
                                <p className="text-sm leading-relaxed mb-6" style={{ color: '#64748B' }}>
                                    {subMessage}
                                </p>

                                <button
                                    onClick={() => navigate('/')}
                                    className="w-full py-3 rounded-xl text-sm font-semibold text-white transition-all"
                                    style={{ backgroundColor: '#1E3A5F' }}
                                    onMouseEnter={e => e.currentTarget.style.opacity = '0.9'}
                                    onMouseLeave={e => e.currentTarget.style.opacity = '1'}
                                >
                                    {isSuccess ? 'Ir para o sistema' : 'Voltar ao início'}
                                </button>
                            </>
                        )}
                    </div>
                </div>

                <p className="text-center text-xs mt-4" style={{ color: '#94A3B8' }}>
                    © {new Date().getFullYear()} LogiFlow — Gestão Logística
                </p>
            </div>
        </div>
    );
}
