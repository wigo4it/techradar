# Stoppen met Azure AD B2C

## Overzicht

| Generiek||
|-|-|
| Doel | Customer Identity & Access Management |
| Huidige oplossing | Azure Active Directory B2C |
| Leverancier | Microsoft |
| Status | Uitfaseringspad ingezet |
| Ondersteuning | Minstens tot mei 2030 |
| Vendor lock-in | Hoog |
| Cloud-geschiktheid | Hoog, maar Microsoft-specifiek |

<br>

| Specifiek||
|-|-|
| Verkoopstop nieuwe tenants | 1 mei 2025 |
| P2-functionaliteit beëindigd | Maart 2026 |
| Innovatierichting | Microsoft Entra External ID |
| Vervanging | Keycloak + SCIM |
| Architectuurprincipe | Open standaarden, vendor-neutraal |

## Rationale

Azure Active Directory B2C is jarenlang een solide oplossing geweest voor externe identiteiten. Microsoft heeft echter duidelijk gemaakt dat het product zijn eindfase ingaat. Nieuwe B2C-tenants kunnen sinds **1 mei 2025** niet meer worden aangemaakt en belangrijke functionaliteit verdwijnt al in **2026**. De ondersteuning loopt door tot **minstens 2030**, maar het strategische zwaartepunt ligt niet langer bij Azure AD B2C.

Zie ook de officiële Microsoft-documentatie:  
https://learn.microsoft.com/azure/active-directory-b2c/faq

Dit betekent dat Azure AD B2C feitelijk een **onderhoudsproduct** is geworden. Nieuwe investeringen hierin vergroten de technische en strategische schuld.

### Waarom stoppen met Azure AD B2C

We willen stoppen met Azure AD B2C omdat het niet langer past bij een toekomstgerichte en autonome identity-strategie.

Belangrijke overwegingen:

- **Beperkte toekomstvastheid**  
  De innovatie verschuift naar andere Microsoft-producten, waardoor B2C vooral stabiel gehouden wordt, maar niet doorontwikkelt.

- **Veranderend licentiemodel**  
  Geavanceerde functionaliteit (P2) verdwijnt al in 2026, wat de waarde van het platform verder onder druk zet.

- **Sterke vendor lock-in**  
  Identity wordt een kernfunctie van onze architectuur; afhankelijkheid van één cloudleverancier vergroot strategisch risico.

- **Migratie wordt onvermijdelijk**  
  Hoe langer we wachten, hoe groter en complexer de uiteindelijke overstap wordt.

Stoppen is geen reactie op een incident, maar een bewuste keuze om vóór de curve te bewegen.

## Vervanging: Keycloak + SCIM

We vervangen Azure AD B2C door een combinatie van **Keycloak** en **SCIM**, gebaseerd op open standaarden en bewezen technologie.

### Keycloak

Keycloak wordt onze centrale Identity & Access Management-oplossing voor externe identiteiten:

- Ondersteuning voor OpenID Connect, OAuth 2.0 en SAML
- Geschikt voor CIAM-scenario’s
- Open source en breed gedragen
- Volledig onder eigen regie te hosten, ook cloud-native

Website: https://www.keycloak.org/

### SCIM

SCIM (System for Cross-domain Identity Management) gebruiken we voor:

- Geautomatiseerde user provisioning
- Lifecycle management van accounts
- Synchronisatie tussen bronsystemen en identity-platform

SCIM is een open standaard (RFC 7643/7644) en sluit logisch aan op Keycloak voor schaalbaar en controleerbaar identiteitsbeheer.

## Waarom deze combinatie logisch is

Keycloak verzorgt authenticatie, autorisatie en identity flows.  
SCIM regelt provisioning en lifecycle.

Samen vormen ze een helder en ontkoppeld identity-landschap:

- **Open standaarden in plaats van platformafhankelijkheid**
- **Volledige controle over data en architectuur**
- **Flexibiliteit voor toekomstige integraties**
- **Betere aansluiting op zero-trust en cloud-native principes**

Identity wordt hiermee een strategische bouwsteen, geen productkeuze.

## Samengevat

We stoppen met Azure AD B2C omdat het product aantoonbaar richting het einde van zijn levenscyclus beweegt, met afnemende innovatie en toenemende beperkingen. Door tijdig over te stappen op **Keycloak in combinatie met SCIM** kiezen we voor autonomie, toekomstvastheid en architecturale helderheid.

Niet wachten tot het moet.  
Maar bewegen omdat het logisch is.
