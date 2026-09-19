import { useEffect, useRef, useState, type FormEvent } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { api, ApiError } from '../api';
import { ErrorState, LoadingState } from '../components/PageState';

type AIStatus = { enabled: boolean; provider: string | null; model: string | null };
type ConversationSummary = { id: string; title: string; createdAt: string; updatedAt: string };
type Message = { id: string; role: 'USER' | 'ASSISTANT'; content: string; createdAt: string };
type Conversation = ConversationSummary & { messages: Message[] };

export function AIPage() {
  const { t, i18n } = useTranslation();
  const client = useQueryClient();
  const [selectedId, setSelectedId] = useState<string>();
  const [draft, setDraft] = useState('');
  const endRef = useRef<HTMLDivElement>(null);
  const status = useQuery({ queryKey: ['ai-status'], queryFn: () => api<AIStatus>('/ai/status'), retry: false });
  const conversations = useQuery({ queryKey: ['ai-conversations'], queryFn: () => api<ConversationSummary[]>('/ai/conversations'), enabled: status.data?.enabled === true });
  const conversation = useQuery({ queryKey: ['ai-conversation', selectedId], queryFn: () => api<Conversation>('/ai/conversations/' + selectedId), enabled: Boolean(selectedId) });
  useEffect(() => { if (!selectedId && conversations.data?.[0]) setSelectedId(conversations.data[0].id); }, [conversations.data, selectedId]);
  useEffect(() => { endRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [conversation.data?.messages]);

  const createConversation = useMutation({
    mutationFn: () => api<ConversationSummary>('/ai/conversations', { method: 'POST', body: '{}' }),
    onSuccess: (item) => { setSelectedId(item.id); void client.invalidateQueries({ queryKey: ['ai-conversations'] }); },
  });
  const deleteConversation = useMutation({
    mutationFn: (id: string) => api('/ai/conversations/' + id, { method: 'DELETE' }),
    onSuccess: () => { setSelectedId(undefined); void client.invalidateQueries({ queryKey: ['ai-conversations'] }); },
  });
  const send = useMutation({
    mutationFn: ({ conversationId, message }: { conversationId: string; message: string }) => api('/ai/conversations/' + conversationId + '/messages', { method: 'POST', body: JSON.stringify({ message }) }),
    onSuccess: () => { setDraft(''); void client.invalidateQueries({ queryKey: ['ai-conversation', selectedId] }); void client.invalidateQueries({ queryKey: ['ai-conversations'] }); },
  });

  if (status.isLoading) return <LoadingState />;
  if (status.isError) return <ErrorState retry={() => void status.refetch()} />;
  if (!status.data?.enabled) return <div className="page"><div className="page-header"><div><h1>{t('ai.title')}</h1><p>{t('ai.unavailable')}</p></div></div></div>;
  const errorMessage = send.error instanceof ApiError && ['AI_PROVIDER_RATE_LIMIT', 'AI_CAPACITY_LIMIT', 'AI_CONCURRENCY_LIMIT'].includes(send.error.code ?? '')
    ? t('ai.providerBusy')
    : send.error instanceof ApiError && send.error.status === 429 ? t('ai.rateLimited') : send.isError ? t('ai.error') : '';

  const submit = (event: FormEvent) => {
    event.preventDefault();
    if (!draft.trim() || send.isPending) return;
    if (!selectedId) {
      createConversation.mutate(undefined, { onSuccess: (item) => { setSelectedId(item.id); send.mutate({ conversationId: item.id, message: draft.trim() }); } });
      return;
    }
    send.mutate({ conversationId: selectedId, message: draft.trim() });
  };

  return <div className="page ai-page">
    <div className="page-header"><div><h1>{t('ai.title')}</h1><p>{t('ai.subtitle')}</p></div><button className="button" type="button" onClick={() => createConversation.mutate()}>{t('ai.newConversation')}</button></div>
    <div className="ai-layout">
      <aside className="ai-conversations" aria-label={t('ai.conversations')}>
        {(conversations.data ?? []).map((item) => <button type="button" className={item.id === selectedId ? 'active' : ''} key={item.id} onClick={() => setSelectedId(item.id)}><span>{item.title}</span><small>{new Intl.DateTimeFormat(i18n.language).format(new Date(item.updatedAt))}</small></button>)}
        {!conversations.isLoading && !conversations.data?.length && <p>{t('ai.noConversations')}</p>}
      </aside>
      <section className="ai-chat section">
        <div className="ai-messages" aria-live="polite">
          {conversation.isLoading && <LoadingState />}
          {!conversation.isLoading && !conversation.data?.messages.length && <div className="empty-state"><strong>{t('ai.emptyTitle')}</strong><span>{t('ai.emptyHint')}</span></div>}
          {conversation.data?.messages.map((message) => <article className={'ai-message ' + message.role.toLowerCase()} key={message.id}><strong>{message.role === 'USER' ? t('ai.you') : t('ai.assistant')}</strong><p>{message.content}</p></article>)}
          {send.isPending && <article className="ai-message assistant"><strong>{t('ai.assistant')}</strong><p>{t('ai.thinking')}</p></article>}
          <div ref={endRef} />
        </div>
        {errorMessage && <p className="form-error">{errorMessage}</p>}
        <form className="ai-compose" onSubmit={submit}><label className="sr-only" htmlFor="ai-message">{t('ai.message')}</label><textarea id="ai-message" maxLength={4000} value={draft} onChange={(event) => setDraft(event.target.value)} placeholder={t('ai.placeholder')} rows={3} onKeyDown={(event) => { if (event.key === 'Enter' && !event.shiftKey) { event.preventDefault(); event.currentTarget.form?.requestSubmit(); } }} /><button className="button primary" disabled={!draft.trim() || send.isPending || createConversation.isPending}>{t('ai.send')}</button></form>
        {selectedId && <button className="text-button danger-text ai-delete" type="button" onClick={() => { if (window.confirm(t('ai.deleteConfirm'))) deleteConversation.mutate(selectedId); }}>{t('ai.deleteConversation')}</button>}
      </section>
    </div>
  </div>;
}
