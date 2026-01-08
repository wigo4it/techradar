# SpecFlow

## Overzicht

| Generiek||
|-|-|
| Doel | BDD-testautomatisering |
| Team(s) | Valori, Summa |
| Website | [https://specflow.org/](https://specflow.org/) |
| Licentievorm | Commercieel |
| Technologie | .NET, Gherkin |
| Volwassenheid | Bewezen, maar afnemend |
| Vendor lock-in | Middel |
| Cloud-geschiktheid | Beperkt |

<br>

| Specifiek||
|-|-|
| Gebruik | Acceptatie- en regressietests |
| Afhankelijkheid | SpecFlow tooling en licentiemodel |
| Alternatieven | Native testframeworks, Playwright, Cypress |
| Impact | Testonderhoud, leercurve, licentiekosten |

## Rationale

SpecFlow is jarenlang gebruikt als BDD-framework om business en IT dichter bij elkaar te brengen via Gherkin-scenario’s. In de praktijk blijkt deze belofte binnen onze context steeds minder waargemaakt te worden, terwijl de complexiteit en kosten zijn toegenomen.

### Waarom stoppen met SpecFlow

We willen stoppen met SpecFlow omdat het onvoldoende bijdraagt aan snellere, betere en beter onderhoudbare software. Wat ooit bedoeld was als brug tussen business en techniek, is in de praktijk verworden tot een extra abstractielaag die vooral door developers wordt onderhouden.

Belangrijke overwegingen hierbij zijn:

- **Beperkte toegevoegde waarde van BDD**  
  Gherkin-scenario’s worden zelden door de business geschreven of onderhouden, waardoor de primaire BDD-belofte niet wordt ingelost.

- **Extra complexiteit zonder duidelijke opbrengst**  
  Tests vereisen mappings, glue-code en specifieke kennis, wat de leesbaarheid en onderhoudbaarheid verlaagt.

- **Licentiekosten en afhankelijkheid**  
  SpecFlow is niet langer volledig open source en introduceert structurele kosten en afhankelijkheid van één leverancier.

- **Vertraging in feedbackloops**  
  Testen zijn vaak zwaarder en trager dan moderne, directere alternatieven.

- **Betere alternatieven beschikbaar**  
  Moderne testframeworks sluiten beter aan bij huidige ontwikkelpraktijken, CI/CD-pipelines en cloud-native architecturen.

Door afscheid te nemen van SpecFlow vereenvoudigen we onze teststack, verlagen we kosten en vergroten we de autonomie van teams. Testen wordt daarmee weer een integraal onderdeel van het ontwikkelproces, in plaats van een specialistisch domein met eigen tooling en afhankelijkheden.
