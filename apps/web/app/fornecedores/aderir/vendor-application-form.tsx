"use client";

import { FormEvent, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { api } from "../../lib/api";

const defaultCategories = ["Catering", "Decoração", "Fotografia e vídeo", "Música e DJ", "Beleza", "Transportes", "Bolos e doces", "Organização", "Espaços", "Outro"];
const defaultProvinces = ["Bengo", "Benguela", "Bié", "Cabinda", "Cuando", "Cubango", "Cuanza Norte", "Cuanza Sul", "Cunene", "Huambo", "Huíla", "Icolo e Bengo", "Luanda", "Lunda Norte", "Lunda Sul", "Malanje", "Moxico", "Moxico Leste", "Namibe", "Uíge", "Zaire"];
type FormValues = { name: string; category: string; province: string; municipality: string; description: string; services: string; serviceAreas: string; phone: string; email: string; websiteUrl: string; instagramUrl: string; facebookUrl: string; tiktokUrl: string };
const empty: FormValues = { name: "", category: "", province: "", municipality: "", description: "", services: "", serviceAreas: "", phone: "", email: "", websiteUrl: "", instagramUrl: "", facebookUrl: "", tiktokUrl: "" };
const splitLines = (value: string) => value.split("\n").map((part) => part.trim()).filter(Boolean);

export default function VendorApplicationForm() {
  const [values, setValues] = useState(empty);
  const [account, setAccount] = useState<{ name: string | null; email: string } | null>(null);
  const [authChecked, setAuthChecked] = useState(false);
  const [notice, setNotice] = useState("");
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const [categories, setCategories] = useState(defaultCategories);
  const [provinces, setProvinces] = useState(defaultProvinces);
  const router = useRouter();
  const next = "/fornecedores/aderir";

  useEffect(() => {
    void api<{ user: { name: string | null; email: string } }>("/auth/me")
      .then(({ user }) => {
        setAccount(user);
        setValues((current) => ({ ...current, name: user.name ?? "", email: user.email }));
      })
      .catch(() => setAccount(null))
      .finally(() => setAuthChecked(true));
    void api<{ vendorCategories: string[]; provinces: string[] }>("/catalog-config")
      .then((config) => {
        if (config.vendorCategories.length) setCategories([...config.vendorCategories, "Outro"]);
        if (config.provinces.length) setProvinces(config.provinces);
      }).catch(() => undefined);
  }, []);
  const change = (key: keyof FormValues, value: string) => setValues((current) => ({ ...current, [key]: value }));

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!account) return;
    setSaving(true); setNotice(""); setError("");
    try {
      const result = await api<{ id: string; message: string }>("/vendor-portal/profiles", {
        method: "POST",
        body: JSON.stringify({
          ...values,
          services: splitLines(values.services),
          serviceAreas: splitLines(values.serviceAreas),
          municipality: values.municipality || undefined,
          description: values.description || undefined,
          phone: values.phone || undefined,
          email: values.email || undefined,
          websiteUrl: values.websiteUrl || undefined,
          instagramUrl: values.instagramUrl || undefined,
          facebookUrl: values.facebookUrl || undefined,
          tiktokUrl: values.tiktokUrl || undefined,
        }),
      });
      setNotice(result.message);
      router.push("/fornecedor/gestao");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Não foi possível criar o perfil.");
    } finally { setSaving(false); }
  }

  if (!authChecked) return <section className="vendor-application-form vendor-auth-gate"><p>A verificar a tua conta…</p></section>;
  if (!account) return <section className="vendor-application-form vendor-auth-gate">
    <div className="vendor-application-intro"><strong>Primeiro, cria a tua conta</strong><p>A conta dá-te acesso à área onde vais acompanhar a revisão, carregar trabalhos e gerir o perfil. Se já tens conta, entra e continua.</p></div>
    <div className="vendor-auth-actions"><a className="button button-primary" href={`/criar-conta?next=${encodeURIComponent(next)}`}>Criar conta de prestador</a><a className="button button-outline" href={`/entrar?next=${encodeURIComponent(next)}`}>Já tenho conta</a></div>
  </section>;

  return <form className="quote-form vendor-application-form" onSubmit={submit}>
    <div className="vendor-application-intro"><strong>Perfil profissional · conta {account.email}</strong><p>Preenche a apresentação do negócio. O perfil começa privado e só aparece no directório quando a equipa o aprovar. Depois podes preparar o portefólio na tua área.</p></div>
    <div className="vendor-application-grid">
      <label>Nome do negócio<input required minLength={2} maxLength={120} value={values.name} onChange={e => change("name", e.target.value)}/></label>
      <label>Categoria<select required value={values.category} onChange={e => change("category", e.target.value)}><option value="">Escolhe uma categoria</option>{categories.map(category => <option key={category}>{category}</option>)}</select></label>
      <label>Província<select required value={values.province} onChange={e => change("province", e.target.value)}><option value="">Escolhe uma província</option>{provinces.map(province => <option key={province}>{province}</option>)}</select></label>
      <label>Município<input maxLength={100} value={values.municipality} onChange={e => change("municipality", e.target.value)}/></label>
      <label>Telefone / WhatsApp<input type="tel" minLength={7} maxLength={40} value={values.phone} onChange={e => change("phone", e.target.value)}/></label>
      <label>Email público<input type="email" maxLength={180} value={values.email} onChange={e => change("email", e.target.value)}/></label>
    </div>
    <label>Sobre o negócio<textarea maxLength={2000} value={values.description} onChange={e => change("description", e.target.value)} placeholder="Apresenta a experiência e a forma como trabalhas."/></label>
    <div className="vendor-application-grid"><label>Serviços, um por linha<textarea value={values.services} onChange={e => change("services", e.target.value)} placeholder="Ex.: decoração floral"/></label><label>Zonas atendidas, uma por linha<textarea value={values.serviceAreas} onChange={e => change("serviceAreas", e.target.value)} placeholder="Ex.: Luanda, Talatona"/></label></div>
    <p className="vendor-application-section-label">Redes sociais e site · ligações HTTPS</p>
    <div className="vendor-application-grid">
      <label>Site<input type="url" placeholder="https://" value={values.websiteUrl} onChange={e => change("websiteUrl", e.target.value)}/></label>
      <label>Instagram<input type="url" placeholder="https://instagram.com/…" value={values.instagramUrl} onChange={e => change("instagramUrl", e.target.value)}/></label>
      <label>Facebook<input type="url" placeholder="https://facebook.com/…" value={values.facebookUrl} onChange={e => change("facebookUrl", e.target.value)}/></label>
      <label>TikTok<input type="url" placeholder="https://tiktok.com/@…" value={values.tiktokUrl} onChange={e => change("tiktokUrl", e.target.value)}/></label>
    </div>
    <p className="vendor-application-privacy">Ao enviar, autorizas a equipa a rever os dados e links do negócio. Nada fica público antes da aprovação. Imagens do portefólio passam por revisão própria.</p>
    <button className="button button-primary" disabled={saving}>{saving ? "A criar perfil…" : "Enviar perfil para revisão"}</button>
    {error && <p className="form-error" role="alert">{error}</p>}{notice && <p className="quote-notice" role="status">{notice}</p>}
  </form>;
}
