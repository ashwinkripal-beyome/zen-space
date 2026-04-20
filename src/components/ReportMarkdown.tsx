import ReactMarkdown from 'react-markdown'

const mdClass =
  'report-markdown max-w-none text-foreground/90 [&_h1]:mb-3 [&_h1]:mt-8 [&_h1]:text-2xl [&_h1]:font-bold [&_h1]:text-foreground [&_h2]:mb-2 [&_h2]:mt-6 [&_h2]:text-xl [&_h2]:font-semibold [&_h2]:text-foreground [&_h3]:mb-2 [&_h3]:mt-4 [&_h3]:text-lg [&_h3]:font-medium [&_h3]:text-foreground/95 [&_p]:mb-3 [&_p]:leading-relaxed [&_ul]:mb-3 [&_ul]:list-disc [&_ul]:pl-6 [&_ol]:mb-3 [&_ol]:list-decimal [&_ol]:pl-6 [&_li]:mb-1 [&_strong]:text-foreground [&_code]:rounded [&_code]:bg-white/10 [&_code]:px-1 [&_code]:text-sky-200 [&_hr]:my-6 [&_hr]:border-white/20'

export function ReportMarkdown({ content }: { content: string }) {
  return (
    <div className={mdClass}>
      <ReactMarkdown>{content}</ReactMarkdown>
    </div>
  )
}
