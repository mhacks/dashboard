--
-- PostgreSQL database dump
--

\restrict PgnghQDa5wPDMjCBflnhUaW0PfsKpeswowKf4cE6alPDF6w1efs6HzkCTq4soux

-- Dumped from database version 17.6
-- Dumped by pg_dump version 18.4 (Homebrew)

SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET transaction_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;

--
-- Name: public; Type: SCHEMA; Schema: -; Owner: -
--

CREATE SCHEMA public;


--
-- Name: SCHEMA public; Type: COMMENT; Schema: -; Owner: -
--

COMMENT ON SCHEMA public IS 'standard public schema';


--
-- Name: application_status; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.application_status AS ENUM (
    'pending',
    'reviewed',
    'flagged'
);


--
-- Name: user_role; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.user_role AS ENUM (
    'hacker',
    'organizer'
);


--
-- Name: handle_new_user(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.handle_new_user() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    AS $$
begin
  insert into public.users (id, email)
  values (new.id, new.email)
  on conflict (id) do nothing;
  return new;
end;
$$;


--
-- Name: rls_auto_enable(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.rls_auto_enable() RETURNS event_trigger
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'pg_catalog'
    AS $$
DECLARE
  cmd record;
BEGIN
  FOR cmd IN
    SELECT *
    FROM pg_event_trigger_ddl_commands()
    WHERE command_tag IN ('CREATE TABLE', 'CREATE TABLE AS', 'SELECT INTO')
      AND object_type IN ('table','partitioned table')
  LOOP
     IF cmd.schema_name IS NOT NULL AND cmd.schema_name IN ('public') AND cmd.schema_name NOT IN ('pg_catalog','information_schema') AND cmd.schema_name NOT LIKE 'pg_toast%' AND cmd.schema_name NOT LIKE 'pg_temp%' THEN
      BEGIN
        EXECUTE format('alter table if exists %s enable row level security', cmd.object_identity);
        RAISE LOG 'rls_auto_enable: enabled RLS on %', cmd.object_identity;
      EXCEPTION
        WHEN OTHERS THEN
          RAISE LOG 'rls_auto_enable: failed to enable RLS on %', cmd.object_identity;
      END;
     ELSE
        RAISE LOG 'rls_auto_enable: skip % (either system schema or not in enforced list: %.)', cmd.object_identity, cmd.schema_name;
     END IF;
  END LOOP;
END;
$$;


--
-- Name: set_updated_at(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.set_updated_at() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
begin
  new."updated_at" = now();
  return new;
end;
$$;


SET default_tablespace = '';

SET default_table_access_method = heap;

--
-- Name: hacker_applicants; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.hacker_applicants (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid NOT NULL,
    status public.application_status DEFAULT 'pending'::public.application_status NOT NULL,
    age integer NOT NULL,
    gender text NOT NULL,
    gender_other text,
    ethnicity text NOT NULL,
    ethnicity_other text,
    university text NOT NULL,
    university_other text,
    country text NOT NULL,
    country_other text,
    degree text NOT NULL,
    degree_other text,
    graduation_year integer NOT NULL,
    previous_hackathons integer NOT NULL,
    major text NOT NULL,
    major_other text,
    resume text,
    what_would_you_do text NOT NULL,
    why_mhacks text NOT NULL,
    hill_to_die_on text NOT NULL,
    anything_else text,
    transportation_type text NOT NULL,
    coming_from text NOT NULL,
    shirt_size text NOT NULL,
    has_allergies boolean NOT NULL,
    allergies_description text,
    needs_travel_reimbursement boolean NOT NULL,
    would_attend_without_reimbursement boolean,
    github text,
    linkedin text,
    personal_site text,
    follows_instagram boolean,
    mlh_code_of_conduct boolean NOT NULL,
    mlh_privacy_policy boolean NOT NULL,
    mlh_emails boolean NOT NULL,
    sponsor_emails boolean,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    review_motivation integer,
    review_builder_mindset integer,
    review_collaboration integer,
    review_creativity integer,
    review_diversity integer,
    flag_for_review boolean DEFAULT false NOT NULL,
    review_notes text,
    airport_code text
);


--
-- Name: hacker_application_drafts; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.hacker_application_drafts (
    user_id uuid NOT NULL,
    data jsonb DEFAULT '{}'::jsonb NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: users; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.users (
    id uuid NOT NULL,
    email text NOT NULL,
    role public.user_role DEFAULT 'hacker'::public.user_role NOT NULL
);


--
-- Name: hacker_applicants hacker_applicants_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.hacker_applicants
    ADD CONSTRAINT hacker_applicants_pkey PRIMARY KEY (id);


--
-- Name: hacker_applicants hacker_applicants_user_id_unique; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.hacker_applicants
    ADD CONSTRAINT hacker_applicants_user_id_unique UNIQUE (user_id);


--
-- Name: hacker_application_drafts hacker_application_drafts_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.hacker_application_drafts
    ADD CONSTRAINT hacker_application_drafts_pkey PRIMARY KEY (user_id);


--
-- Name: users users_email_unique; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_email_unique UNIQUE (email);


--
-- Name: users users_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_pkey PRIMARY KEY (id);


--
-- Name: hacker_applicants hacker_applicants_set_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER hacker_applicants_set_updated_at BEFORE UPDATE ON public.hacker_applicants FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();


--
-- Name: hacker_applicants hacker_applicants_user_id_users_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.hacker_applicants
    ADD CONSTRAINT hacker_applicants_user_id_users_id_fk FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- Name: hacker_application_drafts hacker_application_drafts_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.hacker_application_drafts
    ADD CONSTRAINT hacker_application_drafts_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;


--
-- Name: hacker_applicants; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.hacker_applicants ENABLE ROW LEVEL SECURITY;

--
-- Name: hacker_application_drafts; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.hacker_application_drafts ENABLE ROW LEVEL SECURITY;

--
-- Name: users; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;

--
-- PostgreSQL database dump complete
--

\unrestrict PgnghQDa5wPDMjCBflnhUaW0PfsKpeswowKf4cE6alPDF6w1efs6HzkCTq4soux

