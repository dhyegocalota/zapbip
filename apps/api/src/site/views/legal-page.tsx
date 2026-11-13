import { legalTextOf } from '../legal-copy';
import type { LegalDocument } from '../legal-links';
import type { PageModel } from '../page-model';
import { ContactText } from './contact-text';
import { SiteLayout } from './site-layout';

export function LegalPage(props: { model: PageModel; document: LegalDocument }) {
  const text = legalTextOf({ document: props.document, locale: props.model.locale });
  return (
    <SiteLayout model={props.model} title={text.title} isIndexable>
      <article class="container legal">
        <h1>{text.title}</h1>
        <p class="legal-updated">{text.updated}</p>
        <p class="legal-summary">{text.summary}</p>
        {text.sections.map((section) => (
          <section>
            <h2>{section.heading}</h2>
            {section.paragraphs.map((paragraph) => (
              <p>
                <ContactText text={paragraph} />
              </p>
            ))}
            {section.items.length === 0 ? null : (
              <ul>
                {section.items.map((item) => (
                  <li>
                    <ContactText text={item} />
                  </li>
                ))}
              </ul>
            )}
          </section>
        ))}
      </article>
    </SiteLayout>
  );
}
