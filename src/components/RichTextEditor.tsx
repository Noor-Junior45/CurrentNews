import React from 'react';
import ReactQuill from 'react-quill-new';
import 'react-quill-new/dist/quill.snow.css';
import { 
  AlertTriangle, 
  Lightbulb, 
  ListTodo, 
  Quote, 
  HelpCircle, 
  Sparkles 
} from 'lucide-react';

interface RichTextEditorProps {
  value: string;
  onChange: (content: string) => void;
  placeholder?: string;
}

export default function RichTextEditor({ value, onChange, placeholder }: RichTextEditorProps) {
  
  // Enriched format capabilities for beautiful styling choices (colors, highlights, alignments, links, blockquotes, code blocks)
  const formats = [
    'header',
    'size',
    'bold',
    'italic',
    'underline',
    'strike',
    'blockquote',
    'code-block',
    'list',
    'indent',
    'align',
    'color',
    'background',
    'link',
  ];

  const modules = {
    toolbar: [
      [{ 'header': [1, 2, 3, false] }],
      [{ 'size': ['small', false, 'large', 'huge'] }],
      ['bold', 'italic', 'underline', 'strike'],
      [{ 'color': [] }, { 'background': [] }],          
      [{ 'align': [] }],
      [{ 'list': 'ordered' }, { 'list': 'bullet' }],
      ['blockquote', 'code-block', 'link'],
      ['clean']
    ],
    clipboard: {
      matchVisual: false, // Prevents inserting extraneous inline styles on paste
    }
  };

  const templates = [
    {
      name: 'Alert Banner',
      icon: AlertTriangle,
      color: 'text-red-600 border-red-200 bg-red-50/50 dark:bg-red-950/20 dark:text-red-400 dark:border-red-900/30',
      html: `<div style="background-color: #fef2f2; border-left: 4px solid #ef4444; padding: 12px; margin: 12px 0; border-radius: 4px; color: #991b1b; font-weight: bold;">🚨 BREAKING NEWS: Enter urgent headline here...</div><p><br></p>`
    },
    {
      name: 'Editorial Note',
      icon: Lightbulb,
      color: 'text-indigo-600 border-indigo-200 bg-indigo-50/50 dark:bg-indigo-950/20 dark:text-indigo-400 dark:border-indigo-900/30',
      html: `<div style="background-color: #eef2ff; border-left: 4px solid #6366f1; padding: 12px; margin: 12px 0; border-radius: 4px; color: #3730a3; font-style: italic;">💡 EDITORIAL NOTE: Enter editorial perspective or expert insight here...</div><p><br></p>`
    },
    {
      name: 'Key Takeaways',
      icon: ListTodo,
      color: 'text-emerald-600 border-emerald-200 bg-emerald-50/50 dark:bg-emerald-950/20 dark:text-emerald-400 dark:border-emerald-900/30',
      html: `<div style="background-color: #f0fdf4; border: 1px solid #bbf7d0; padding: 16px; margin: 12px 0; border-radius: 8px; color: #166534;"><strong style="color: #14532d; font-size: 14px;">📋 KEY TAKEAWAYS:</strong><ul style="margin-top: 8px; list-style-type: disc; padding-left: 20px;"><li>First critical learning point</li><li>Second critical learning point</li></ul></div><p><br></p>`
    },
    {
      name: 'Highlight Quote',
      icon: Quote,
      color: 'text-amber-600 border-amber-200 bg-amber-50/50 dark:bg-amber-950/20 dark:text-amber-400 dark:border-amber-900/30',
      html: `<blockquote style="border-left: 4px solid #d97706; padding-left: 16px; font-style: italic; color: #78350f; font-size: 16px; margin: 16px 0;">“Enter powerful quote statement here” — Name, Designation</blockquote><p><br></p>`
    },
    {
      name: 'Interview Q&A',
      icon: HelpCircle,
      color: 'text-purple-600 border-purple-200 bg-purple-50/50 dark:bg-purple-950/20 dark:text-purple-400 dark:border-purple-900/30',
      html: `<p><strong style="color: #4f46e5;">Q: Enter interviewer question here?</strong></p><p style="color: #334155; padding-left: 12px;">A: Enter interviewee response here. Keep it structured and clear.</p><p><br></p>`
    }
  ];

  const injectTemplate = (html: string) => {
    const currentVal = value || '';
    onChange(currentVal + html);
  };

  return (
    <div className="w-full flex flex-col" id="quill-editor-wrapper">
      {/* Writing Assistant Glassmorphic Panel */}
      <div className="p-3 bg-slate-50/60 dark:bg-slate-900/60 backdrop-blur-md border-b border-slate-200 dark:border-slate-800">
        <div className="flex items-center gap-1.5 mb-2">
          <Sparkles className="h-4 w-4 text-indigo-500 animate-pulse" />
          <span className="text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider font-mono">
            Writing Assistant & Design Presets
          </span>
        </div>
        <div className="flex flex-wrap gap-1.5 overflow-x-auto pb-1 scrollbar-none">
          {templates.map((tpl) => {
            const IconComponent = tpl.icon;
            return (
              <button
                key={tpl.name}
                type="button"
                onClick={() => injectTemplate(tpl.html)}
                className={`inline-flex items-center gap-1 text-[10px] font-bold px-2.5 py-1.5 border rounded-full transition-all duration-200 hover:scale-[1.02] cursor-pointer shadow-2xs shrink-0 ${tpl.color}`}
              >
                <IconComponent className="h-3 w-3 shrink-0" />
                <span>{tpl.name}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Main Editor Component */}
      <div className="bg-white dark:bg-slate-950">
        <ReactQuill
          theme="snow"
          value={value}
          onChange={onChange}
          modules={modules}
          formats={formats}
          placeholder={placeholder || "Compose your news post story here..."}
        />
      </div>

      {/* Editor Status Indicator */}
      <div className="flex justify-between items-center px-3 py-1.5 bg-slate-50 dark:bg-slate-900 border-t border-slate-200 dark:border-slate-800 text-[10px] text-slate-400 dark:text-slate-500 font-mono rounded-b-lg">
        <span>Press any layout preset above to instant-inject formatting templates.</span>
        <span>HTML Active</span>
      </div>
    </div>
  );
}
