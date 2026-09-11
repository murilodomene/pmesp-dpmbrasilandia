UPDATE public.denuncias SET unidade = NULL WHERE unidade IS NOT NULL;
UPDATE public.denuncia_policiais SET unidade = NULL WHERE unidade IS NOT NULL;
UPDATE public.profiles SET unidade = NULL WHERE unidade IS NOT NULL;

ALTER TYPE public.unidade_pc RENAME VALUE 'DEIC' TO 'CPC';
ALTER TYPE public.unidade_pc RENAME VALUE 'CORREGEPOL' TO 'CPA/M-3';
ALTER TYPE public.unidade_pc RENAME VALUE 'DECAP' TO '18º BPM';
ALTER TYPE public.unidade_pc RENAME VALUE 'DHPP' TO 'Força Tática';
ALTER TYPE public.unidade_pc RENAME VALUE 'CERCO' TO '4º BAEP';
ALTER TYPE public.unidade_pc RENAME VALUE 'GARRA' TO 'CAEP';
ALTER TYPE public.unidade_pc RENAME VALUE 'DENARC' TO '4º BPRV';
ALTER TYPE public.unidade_pc RENAME VALUE 'GER' TO '1º BTran';
ALTER TYPE public.unidade_pc RENAME VALUE 'SAT' TO 'CavPM';
ALTER TYPE public.unidade_pc RENAME VALUE 'GOE' TO 'CPCHq';
ALTER TYPE public.unidade_pc ADD VALUE '1º BPchq - ROTA';
ALTER TYPE public.unidade_pc ADD VALUE '2º BPchq - Anchieta';
ALTER TYPE public.unidade_pc ADD VALUE '3º BPchq - Humaitá';
ALTER TYPE public.unidade_pc ADD VALUE '4º BPchq - COE/GATE';
ALTER TYPE public.unidade_pc ADD VALUE '4ºGB - Bombeiros';