import type { FormEvent, ReactNode } from 'react';

export type PageKey = 'home' | 'backlog' | 'board' | 'github' | 'activity' | 'team' | 'chat' | 'files' | 'notes' | 'analytics' | 'settings';
export type Task = { id: string; title: string; status: string; type: string; person: string; initials: string; due: string; priority: string; description: string; isBlocked?: boolean; dueAt?: string | null };

export type GithubState = 'connected' | 'failed' | 'disconnected';
export type Message = { initials: string; name: string; text: string; time: string; tone: string };
export type PageHeading = (action?: ReactNode, subtitle?: string) => ReactNode;
export type AddTaskButton = (label?: string) => ReactNode;
export type FormHandler = (event: FormEvent<HTMLFormElement>) => void;
