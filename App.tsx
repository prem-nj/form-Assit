
import React, { useState, useEffect, useRef } from 'react';
import { UserProfile, AppView, Language, FormFieldOverlay, DashboardTab, FormRecord, UploadedDocument, FormTemplate, ScanResult } from './types';
import { extractProfileFromImage, analyzeFormAndMapData, editImage, getFormExplanation, askFormQuestion } from './services/gemini';
import { translations } from './translations';

// --- Styles ---
const GlobalStyles = () => (
  <style>{`
    @keyframes slideUp {
      from { transform: translateY(100%); opacity: 0; }
      to { transform: translateY(0); opacity: 1; }
    }
    .animate-slideUp {
      animation: slideUp 0.3s ease-out forwards;
    }
    @keyframes slideRight {
      from { transform: translateX(-100%); }
      to { transform: translateX(0); }
    }
    .animate-slideRight {
      animation: slideRight 0.3s ease-out forwards;
    }
    @keyframes pulse-ring {
      0% { transform: scale(0.95); box-shadow: 0 0 0 0 rgba(59, 130, 246, 0.7); }
      70% { transform: scale(1); box-shadow: 0 0 0 10px rgba(59, 130, 246, 0); }
      100% { transform: scale(0.95); box-shadow: 0 0 0 0 rgba(59, 130, 246, 0); }
    }
    .animate-pulse-ring {
      animation: pulse-ring 2s cubic-bezier(0.4, 0, 0.6, 1) infinite;
    }
    @keyframes bounce-horizontal {
      0%, 100% { transform: translateX(0); }
      50% { transform: translateX(25%); }
    }
    .animate-bounce-horizontal {
      animation: bounce-horizontal 1s infinite;
    }
  `}</style>
);

// --- Components ---

const LanguageSelector = ({ onSelect }: { onSelect: (lang: Language) => void }) => {
  return (
    <div className="flex flex-col items-center justify-center h-full p-6 space-y-6 bg-slate-50 dark:bg-slate-900 transition-colors duration-300">
      <div className="w-20 h-20 bg-blue-600 rounded-2xl flex items-center justify-center shadow-xl shadow-blue-200 dark:shadow-blue-900/30 mb-4 transform rotate-3">
         <svg className="w-10 h-10 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>
      </div>
      <div className="text-center">
        <h1 className="text-3xl font-bold text-slate-900 dark:text-white tracking-tight mb-2">FormAssist AI</h1>
        <p className="text-slate-500 dark:text-slate-400 max-w-xs mx-auto text-sm leading-relaxed">Select your preferred language to get started with AI-powered form filling.</p>
      </div>
      <div className="grid grid-cols-1 gap-4 w-full max-w-xs mt-4">
        <button
          onClick={() => onSelect('en')}
          className="p-4 bg-white dark:bg-slate-800 border border-slate-100 dark:border-slate-700 rounded-2xl shadow-sm hover:border-blue-500 hover:shadow-lg hover:shadow-blue-100 dark:hover:shadow-blue-900/20 transition-all font-medium text-lg flex items-center justify-between group"
        >
          <div className="flex items-center space-x-3">
            <span className="w-8 h-8 rounded-full bg-blue-50 dark:bg-blue-900/50 flex items-center justify-center text-xs font-bold text-blue-600 dark:text-blue-400">EN</span>
            <span className="text-slate-900 dark:text-white">English</span>
          </div>
          <span className="text-slate-300 group-hover:text-blue-500 transition-colors">→</span>
        </button>
        <button
          onClick={() => onSelect('hi')}
          className="p-4 bg-white dark:bg-slate-800 border border-slate-100 dark:border-slate-700 rounded-2xl shadow-sm hover:border-blue-500 hover:shadow-lg hover:shadow-blue-100 dark:hover:shadow-blue-900/20 transition-all font-medium text-lg flex items-center justify-between group"
        >
          <div className="flex items-center space-x-3">
             <span className="w-8 h-8 rounded-full bg-orange-50 dark:bg-orange-900/50 flex items-center justify-center text-xs font-bold text-orange-600 dark:text-orange-400">HI</span>
             <span className="text-slate-900 dark:text-white">हिन्दी</span>
          </div>
          <span className="text-slate-300 group-hover:text-blue-500 transition-colors">→</span>
        </button>
        <button
          onClick={() => onSelect('bn')}
          className="p-4 bg-white dark:bg-slate-800 border border-slate-100 dark:border-slate-700 rounded-2xl shadow-sm hover:border-blue-500 hover:shadow-lg hover:shadow-blue-100 dark:hover:shadow-blue-900/20 transition-all font-medium text-lg flex items-center justify-between group"
        >
           <div className="flex items-center space-x-3">
             <span className="w-8 h-8 rounded-full bg-green-50 dark:bg-green-900/50 flex items-center justify-center text-xs font-bold text-green-600 dark:text-green-400">BN</span>
             <span className="text-slate-900 dark:text-white">বাংলা</span>
           </div>
          <span className="text-slate-300 group-hover:text-blue-500 transition-colors">→</span>
        </button>
      </div>
    </div>
  );
};

const Onboarding = ({ 
  language, 
  onProfileSaved,
  onCancel,
  initialProfile
}: { 
  language: Language; 
  onProfileSaved: (profile: UserProfile) => void;
  onCancel?: () => void;
  initialProfile?: UserProfile;
}) => {
  const t = translations[language];
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState<Partial<UserProfile> | null>(null);
  const [selectedDocType, setSelectedDocType] = useState('Aadhar Card');
  const [pendingDocs, setPendingDocs] = useState<UploadedDocument[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (initialProfile && !formData) {
        setFormData(initialProfile);
    }
  }, [initialProfile]);

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    setLoading(true);
    let mergedProfile = { ...(formData || initialProfile || {}) };
    const newDocs: UploadedDocument[] = [];

    try {
      for (let i = 0; i < files.length; i++) {
        const file = files[i];
        const base64 = await new Promise<string>((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = (e) => resolve(e.target?.result as string);
            reader.onerror = reject;
            reader.readAsDataURL(file);
        });

        const extracted = await extractProfileFromImage(base64);
        
        mergedProfile = {
          ...mergedProfile,
          ...extracted,
          fullName: extracted.fullName || mergedProfile.fullName || '',
          dateOfBirth: extracted.dateOfBirth || mergedProfile.dateOfBirth || '',
          address: extracted.address || mergedProfile.address || '',
          idNumber: extracted.idNumber || mergedProfile.idNumber || '',
          phoneNumber: mergedProfile.phoneNumber || extracted.phoneNumber || '',
          email: mergedProfile.email || extracted.email || '',
        };
        
        newDocs.push({
            type: selectedDocType,
            date: new Date().toLocaleDateString(),
            verified: true
        });
      }

      setFormData(mergedProfile);
      setPendingDocs(prev => [...prev, ...newDocs]);
    } catch (err) {
      console.error(err);
      alert("Failed to extract data. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    const form = e.target as HTMLFormElement;
    
    const existingDocs = initialProfile?.documents || [];
    const updatedDocs = [...existingDocs, ...pendingDocs];

    const profile: UserProfile = {
      fullName: (form.elements.namedItem('fullName') as HTMLInputElement).value,
      dateOfBirth: (form.elements.namedItem('dateOfBirth') as HTMLInputElement).value,
      address: (form.elements.namedItem('address') as HTMLTextAreaElement).value,
      idNumber: (form.elements.namedItem('idNumber') as HTMLInputElement).value,
      phoneNumber: (form.elements.namedItem('phoneNumber') as HTMLInputElement).value,
      email: (form.elements.namedItem('email') as HTMLInputElement).value,
      documents: updatedDocs
    };
    onProfileSaved(profile);
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center h-full space-y-6 bg-slate-50 dark:bg-slate-900 transition-colors duration-300">
        <div className="relative">
          <div className="w-20 h-20 border-4 border-blue-200 dark:border-blue-900 border-t-blue-600 rounded-full animate-spin"></div>
          <div className="absolute inset-0 flex items-center justify-center">
             <div className="w-10 h-10 bg-white dark:bg-slate-800 rounded-full shadow-inner"></div>
          </div>
        </div>
        <div className="text-center">
          <h3 className="text-lg font-bold text-slate-800 dark:text-white mb-1">{t.extracting}</h3>
          <p className="text-slate-500 dark:text-slate-400 text-sm">Processing your documents...</p>
        </div>
      </div>
    );
  }

  if (formData) {
    return (
      <div className="h-full overflow-y-auto bg-slate-50 dark:bg-slate-900 transition-colors duration-300">
        <div className="p-6 pb-32">
          <div className="flex items-center mb-6">
             {onCancel && (
                <button onClick={onCancel} className="p-2 -ml-2 mr-2 rounded-full hover:bg-slate-200 dark:hover:bg-slate-800 text-slate-600 dark:text-slate-300">
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" /></svg>
                </button>
             )}
             <h2 className="text-2xl font-bold text-slate-900 dark:text-white">{t.verifyDetails}</h2>
          </div>
          
          <form onSubmit={handleSave} className="space-y-6">
            <div className="bg-white dark:bg-slate-800 p-6 rounded-3xl shadow-lg shadow-slate-200/50 dark:shadow-none space-y-5 border border-slate-100 dark:border-slate-700">
              <div>
                <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">{t.fullName}</label>
                <input name="fullName" defaultValue={formData.fullName} className="w-full p-3 bg-slate-50 dark:bg-slate-900 border-none rounded-xl focus:bg-blue-50 dark:focus:bg-slate-700 focus:ring-2 focus:ring-blue-500/20 transition-all font-semibold text-slate-900 dark:text-white" required />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">{t.dob}</label>
                  <input name="dateOfBirth" defaultValue={formData.dateOfBirth} className="w-full p-3 bg-slate-50 dark:bg-slate-900 border-none rounded-xl focus:bg-blue-50 dark:focus:bg-slate-700 focus:ring-2 focus:ring-blue-500/20 transition-all font-medium text-slate-900 dark:text-white" />
                </div>
                 <div>
                  <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">{t.idNumber}</label>
                  <input name="idNumber" defaultValue={formData.idNumber} className="w-full p-3 bg-slate-50 dark:bg-slate-900 border-none rounded-xl focus:bg-blue-50 dark:focus:bg-slate-700 focus:ring-2 focus:ring-blue-500/20 transition-all font-medium text-slate-900 dark:text-white" />
                </div>
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">{t.address}</label>
                <textarea name="address" defaultValue={formData.address} className="w-full p-3 bg-slate-50 dark:bg-slate-900 border-none rounded-xl focus:bg-blue-50 dark:focus:bg-slate-700 focus:ring-2 focus:ring-blue-500/20 transition-all font-medium text-slate-900 dark:text-white" rows={3} />
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">{t.phone}</label>
                <input name="phoneNumber" defaultValue={formData.phoneNumber} className="w-full p-3 bg-slate-50 dark:bg-slate-900 border-none rounded-xl focus:bg-blue-50 dark:focus:bg-slate-700 focus:ring-2 focus:ring-blue-500/20 transition-all font-medium text-slate-900 dark:text-white" />
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">{t.email}</label>
                <input name="email" defaultValue={formData.email} className="w-full p-3 bg-slate-50 dark:bg-slate-900 border-none rounded-xl focus:bg-blue-50 dark:focus:bg-slate-700 focus:ring-2 focus:ring-blue-500/20 transition-all font-medium text-slate-900 dark:text-white" />
              </div>

               {pendingDocs.length > 0 && (
                   <div className="p-3 bg-green-50 dark:bg-green-900/20 rounded-xl text-green-700 dark:text-green-300 text-sm font-medium flex items-center">
                       <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg>
                       {pendingDocs.length} new document{pendingDocs.length > 1 ? 's' : ''} ready to save.
                   </div>
               )}
            </div>
            
            <button type="submit" className="fixed bottom-8 left-6 right-6 py-4 bg-blue-600 text-white rounded-2xl font-bold text-lg shadow-xl shadow-blue-500/30 hover:bg-blue-700 hover:scale-[1.02] active:scale-95 transition-all z-20">
              {t.saveProfile}
            </button>
          </form>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full bg-slate-50 dark:bg-slate-900 transition-colors duration-300">
       <div className="flex items-center justify-between p-6">
          <h2 className="text-xl font-bold text-slate-900 dark:text-white">{t.uploadIdCard}</h2>
          {onCancel && (
             <button onClick={onCancel} className="bg-white dark:bg-slate-800 p-2 rounded-full shadow-sm text-slate-500 dark:text-slate-400">
               <svg className="w-5 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
             </button>
          )}
       </div>

       <div className="flex-1 flex flex-col px-6 pb-8">
          <p className="text-slate-500 dark:text-slate-400 mb-6 font-medium text-sm">{t.uploadIdInstructions}</p>
          
          <div className="flex space-x-2 overflow-x-auto pb-4 no-scrollbar mb-4">
             {['Aadhar Card', 'PAN Card', 'Passport', 'Driver\'s License', 'Other'].map(type => (
                <button 
                  key={type} 
                  onClick={() => {
                    setSelectedDocType(type);
                    fileInputRef.current?.click();
                  }}
                  className={`px-4 py-2 rounded-full text-xs font-bold whitespace-nowrap transition-colors ${type === selectedDocType ? 'bg-slate-900 dark:bg-blue-600 text-white' : 'bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-700'}`}
                >
                  {type}
                </button>
             ))}
          </div>

          <div 
             className="flex-1 bg-white dark:bg-slate-800 border-2 border-dashed border-slate-200 dark:border-slate-700 rounded-[2.5rem] flex flex-col items-center justify-center relative overflow-hidden group hover:border-blue-400 transition-colors cursor-pointer"
             onClick={() => fileInputRef.current?.click()}
          >
             <div className="w-20 h-20 bg-blue-50 dark:bg-blue-900/30 rounded-full flex items-center justify-center mb-6 group-hover:scale-110 transition-transform duration-300">
                <svg className="w-8 h-8 text-blue-600 dark:text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" /></svg>
             </div>
             <h3 className="text-lg font-bold text-slate-800 dark:text-white mb-2">Scan {selectedDocType}</h3>
             <p className="text-slate-400 text-xs max-w-[200px] text-center">We will automatically extract details using AI. Multiple files supported.</p>
             
             <div className="absolute bottom-10">
                <button className="bg-blue-600 text-white px-8 py-3 rounded-xl font-bold text-sm shadow-lg shadow-blue-200 dark:shadow-blue-900/50">
                   Select Images
                </button>
             </div>
          </div>
       </div>

      <input 
        type="file" 
        accept="image/*" 
        multiple
        ref={fileInputRef}
        onChange={handleFileUpload}
        className="hidden"
      />
    </div>
  );
};

const MagicEditor = ({ language, onClose }: { language: Language; onClose: () => void }) => {
    const t = translations[language];
    const [image, setImage] = useState<string | null>(null);
    const [resultImage, setResultImage] = useState<string | null>(null);
    const [prompt, setPrompt] = useState('');
    const [loading, setLoading] = useState(false);
    const fileInputRef = useRef<HTMLInputElement>(null);

    const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (file) {
          const reader = new FileReader();
          reader.onload = (e) => setImage(e.target?.result as string);
          reader.readAsDataURL(file);
        }
      };
    
      const handleGenerate = async () => {
        if (!image || !prompt) return;
        setLoading(true);
        try {
          const edited = await editImage(image, prompt);
          setResultImage(edited);
        } catch (e) {
          console.error(e);
          alert('Failed to edit image. Please try again.');
        } finally {
          setLoading(false);
        }
      };

    return (
        <div className="flex flex-col h-full bg-slate-900 text-white">
          <div className="p-6 flex items-center justify-between">
            <button onClick={onClose} className="p-2 rounded-full bg-white/10 hover:bg-white/20">
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" /></svg>
            </button>
            <h2 className="font-bold text-lg">{t.magicEditor}</h2>
            <div className="w-10"></div>
          </div>
          
          <div className="flex-1 overflow-y-auto p-4">
             {!image ? (
                <div onClick={() => fileInputRef.current?.click()} className="h-full border-2 border-dashed border-slate-700 rounded-3xl flex flex-col items-center justify-center text-slate-500 cursor-pointer hover:border-purple-500 hover:text-purple-400 transition-all">
                    <svg className="w-12 h-12 mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>
                    <span className="font-medium">{t.selectImage}</span>
                </div>
             ) : (
                <div className="space-y-6">
                    <div className="relative rounded-2xl overflow-hidden bg-black">
                        <img src={resultImage || image} className="w-full h-auto object-contain max-h-[50vh]" />
                        {loading && <div className="absolute inset-0 bg-black/50 flex items-center justify-center"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-white"></div></div>}
                    </div>
                    
                    <div className="bg-slate-800 p-4 rounded-2xl space-y-3">
                        <textarea value={prompt} onChange={e => setPrompt(e.target.value)} placeholder={t.promptPlaceholder} className="w-full bg-slate-900 rounded-xl p-3 text-white placeholder-slate-500 min-h-[80px]" />
                        <button onClick={handleGenerate} disabled={loading || !prompt} className="w-full bg-purple-600 text-white py-3 rounded-xl font-bold shadow-lg shadow-purple-900/50 disabled:opacity-50">
                           {t.generate}
                        </button>
                    </div>
                </div>
             )}
          </div>
          <input type="file" ref={fileInputRef} onChange={handleFileUpload} className="hidden" accept="image/*" />
        </div>
    );
};

const TemplatesView = ({
    language,
    templates,
    onSelectTemplate,
    onOpenSidebar
}: {
    language: Language;
    templates: FormTemplate[];
    onSelectTemplate: (t: FormTemplate) => void;
    onOpenSidebar: () => void;
}) => {
    const t = translations[language];

    return (
        <div className="flex-1 overflow-y-auto px-6 pt-6 pb-24 bg-slate-50 dark:bg-slate-900 transition-colors duration-300">
            <div className="flex items-center mb-6">
                <button onClick={onOpenSidebar} className="p-2 -ml-2 rounded-full hover:bg-slate-200 dark:hover:bg-slate-800 text-slate-900 dark:text-white">
                    <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" /></svg>
                </button>
                <h2 className="ml-2 text-2xl font-bold text-slate-900 dark:text-white">{t.templates}</h2>
            </div>

            {templates.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-64 text-center">
                    <div className="w-16 h-16 bg-slate-200 dark:bg-slate-800 rounded-full flex items-center justify-center mb-4">
                        <svg className="w-8 h-8 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>
                    </div>
                    <p className="text-slate-500 dark:text-slate-400 font-medium">{t.noTemplates}</p>
                </div>
            ) : (
                <div className="grid grid-cols-1 gap-4">
                    {templates.map(temp => (
                        <div key={temp.id} className="bg-white dark:bg-slate-800 p-4 rounded-2xl shadow-sm border border-slate-100 dark:border-slate-700 flex items-center justify-between">
                            <div>
                                <h4 className="font-bold text-slate-900 dark:text-white text-lg">{temp.name}</h4>
                                <p className="text-slate-500 dark:text-slate-400 text-xs mt-1">Saved on {new Date(temp.createdAt).toLocaleDateString()}</p>
                            </div>
                            <button
                                onClick={() => onSelectTemplate(temp)}
                                className="px-4 py-2 bg-blue-100 dark:bg-blue-900 text-blue-700 dark:text-blue-300 rounded-lg text-sm font-bold hover:bg-blue-200 dark:hover:bg-blue-800"
                            >
                                {t.useTemplate}
                            </button>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
};

const Scanner = ({ 
  language, 
  userProfile, 
  onClose,
  onComplete,
  onSaveTemplate,
  initialTemplate,
}: { 
  language: Language; 
  userProfile: UserProfile; 
  onClose: () => void;
  onComplete: () => void;
  onSaveTemplate: (name: string, overlays: FormFieldOverlay[]) => void;
  initialTemplate?: FormTemplate;
}) => {
  const t = translations[language];
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const [analyzing, setAnalyzing] = useState(false);
  const [result, setResult] = useState<ScanResult | null>(null);
  const [imageDimensions, setImageDimensions] = useState<{width: number, height: number} | null>(null);
  const [speaking, setSpeaking] = useState(false);
  const [listening, setListening] = useState(false);
  const [showSaveTemplate, setShowSaveTemplate] = useState(false);
  const [permissionDenied, setPermissionDenied] = useState(false);
  
  // Guided Mode State
  const [isGuidedMode, setIsGuidedMode] = useState(true);
  const [currentFieldIndex, setCurrentFieldIndex] = useState(0);

  // Initialize camera
  useEffect(() => {
    let isMounted = true;

    const startCamera = async () => {
      setPermissionDenied(false);
      
      // Clear existing stream
      if (streamRef.current) {
         streamRef.current.getTracks().forEach(t => t.stop());
         streamRef.current = null;
      }

      try {
        if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
           throw new Error("Camera not supported");
        }
        
        let stream: MediaStream;
        try {
            stream = await navigator.mediaDevices.getUserMedia({ 
                video: { facingMode: 'environment' } 
            });
        } catch (err: any) {
            console.warn("Environment camera failed, trying default", err);
            // Fallback for permissions issues on specific facing modes or devices
            stream = await navigator.mediaDevices.getUserMedia({ video: true });
        }

        if (!isMounted) {
            stream.getTracks().forEach(t => t.stop());
            return;
        }

        streamRef.current = stream;

        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          // Play needs to be called after assignment
          try {
             await videoRef.current.play();
          } catch (e) {
             console.error("Autoplay failed", e);
          }
        }
      } catch (err: any) {
        if (!isMounted) return;
        console.error("Camera access error:", err);
        if (err.name === 'NotAllowedError' || err.name === 'PermissionDeniedError' || err.message.includes('Permission denied')) {
            setPermissionDenied(true);
        }
      }
    };

    if (!result) {
        startCamera();
    } else {
        // Stop camera if showing result
        if (streamRef.current) {
            streamRef.current.getTracks().forEach(t => t.stop());
            streamRef.current = null;
        }
    }

    return () => {
        isMounted = false;
        if (streamRef.current) {
            streamRef.current.getTracks().forEach(track => track.stop());
            streamRef.current = null;
        }
    };
  }, [result]);

  // Load template if provided
  useEffect(() => {
      if (initialTemplate && !result) {
          // In a real app, we would capture a frame immediately or guide alignment.
          // For this simulation, we'll wait for user capture, then apply template.
      }
  }, [initialTemplate]);

  const captureAndAnalyze = async () => {
    if (!videoRef.current || !canvasRef.current) return;

    const video = videoRef.current;
    const canvas = canvasRef.current;
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    setImageDimensions({ width: video.videoWidth, height: video.videoHeight });
    
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
    const base64 = canvas.toDataURL('image/jpeg');
    
    // Pause video
    video.pause();
    
    if (initialTemplate) {
        // Template Mode: Use stored overlays but re-map values from current profile
        const remappedOverlays = initialTemplate.overlays.map(overlay => {
            // Simple re-mapping logic (matches extractProfileFromImage keys roughly)
            let newValue = overlay.valueToFill;
            const key = overlay.fieldName.toLowerCase();
            if (key.includes('name')) newValue = userProfile.fullName;
            else if (key.includes('birth') || key.includes('dob')) newValue = userProfile.dateOfBirth;
            else if (key.includes('address')) newValue = userProfile.address;
            else if (key.includes('phone')) newValue = userProfile.phoneNumber;
            else if (key.includes('pan') || key.includes('id') || key.includes('aadhar')) newValue = userProfile.idNumber;
            else if (key.includes('email')) newValue = userProfile.email;
            
            return { ...overlay, valueToFill: newValue };
        });

        setResult({ image: base64, overlays: remappedOverlays });
        return;
    }

    setAnalyzing(true);
    try {
      const overlays = await analyzeFormAndMapData(base64, userProfile);
      setResult({ image: base64, overlays });
    } catch (err) {
      console.error(err);
      alert("Analysis failed. Try again.");
      video.play();
    } finally {
      setAnalyzing(false);
    }
  };

  const handleRetake = () => {
    setResult(null);
    setCurrentFieldIndex(0);
    setImageDimensions(null);
    setPermissionDenied(false);
    // Camera will restart via useEffect because result becomes null
  };

  const handleExplainForm = async () => {
    if (!result) return;
    setSpeaking(true);
    try {
        const text = await getFormExplanation(result.image, language);
        speak(text);
    } finally {
        setSpeaking(false);
    }
  };

  const handleAskQuestion = async () => {
      if (!result) return;
      setListening(true);
      
      const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
      if (!SpeechRecognition) {
          alert("Voice recognition not supported in this browser.");
          setListening(false);
          return;
      }
      
      const recognition = new SpeechRecognition();
      recognition.lang = language === 'hi' ? 'hi-IN' : language === 'bn' ? 'bn-IN' : 'en-US';
      recognition.start();

      recognition.onresult = async (event: any) => {
          const question = event.results[0][0].transcript;
          setListening(false);
          setSpeaking(true);
          const answer = await askFormQuestion(result.image, question, language);
          speak(answer);
          setSpeaking(false);
      };

      recognition.onerror = () => {
          setListening(false);
          alert("Could not hear you.");
      };
  };

  const speak = (text: string) => {
      const utterance = new SpeechSynthesisUtterance(text);
      utterance.lang = language === 'hi' ? 'hi-IN' : language === 'bn' ? 'bn-IN' : 'en-US';
      window.speechSynthesis.speak(utterance);
  };

  if (permissionDenied) {
      return (
          <div className="flex flex-col items-center justify-center h-full bg-slate-900 text-white p-6 text-center">
              <div className="w-20 h-20 bg-red-500/20 rounded-full flex items-center justify-center mb-6">
                  <svg className="w-10 h-10 text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" /></svg>
              </div>
              <h2 className="text-2xl font-bold mb-2">{t.cameraPermission}</h2>
              <p className="text-slate-400 mb-6">Please enable camera access in your browser settings to use the scanner.</p>
              <div className="flex space-x-4">
                  <button onClick={onClose} className="px-6 py-3 bg-slate-800 rounded-xl font-bold">Go Back</button>
                  <button onClick={() => { setPermissionDenied(false); setResult(null); /* Triggers effect */ }} className="px-6 py-3 bg-blue-600 rounded-xl font-bold">Retry</button>
              </div>
          </div>
      );
  }

  return (
    <div className="flex flex-col h-full bg-black relative">
       {/* Top Bar */}
      <div className="absolute top-0 left-0 right-0 p-4 flex justify-between items-start z-20 bg-gradient-to-b from-black/70 to-transparent">
        <button onClick={onClose} className="p-2 rounded-full bg-white/20 text-white backdrop-blur-md">
           <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
        </button>
        {result && (
            <div className="flex space-x-2">
                 <button 
                    onClick={() => setIsGuidedMode(!isGuidedMode)}
                    className="p-2 px-4 rounded-full bg-white/20 text-white backdrop-blur-md text-sm font-bold flex items-center hover:bg-white/30 transition-all"
                 >
                    {isGuidedMode ? (
                        <>
                           {/* Expert Toggle: Switch to Full View */}
                           <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2V6zM14 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V6zM4 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2v-2zM14 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z" /></svg>
                           {t.fullView}
                        </>
                    ) : (
                        <>
                            {/* Toggle back to Guided View */}
                           <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" /></svg>
                           {t.guidedMode}
                        </>
                    )}
                 </button>
                 <button onClick={handleRetake} className="p-2 rounded-full bg-white/20 text-white backdrop-blur-md text-sm font-bold hover:bg-white/30 transition-all">
                    {t.retake}
                 </button>
            </div>
        )}
      </div>

      {/* Main Viewport */}
      <div className="flex-1 relative overflow-hidden flex items-center justify-center">
        <video 
            ref={videoRef} 
            autoPlay 
            playsInline 
            muted 
            className={`absolute inset-0 w-full h-full object-cover ${result ? 'hidden' : 'block'}`} 
        />
        <canvas ref={canvasRef} className="hidden" />
        
        {/* Result Image & Overlays */}
        {result && (
             <div className="relative w-full h-full flex items-center justify-center bg-black">
                <div 
                    className="relative"
                    style={{
                        aspectRatio: imageDimensions ? `${imageDimensions.width}/${imageDimensions.height}` : 'auto',
                        width: '100%',
                        maxHeight: '100%'
                    }}
                >
                    <img src={result.image} className="w-full h-full object-contain" />
                    
                    {/* Overlays */}
                    {result.overlays.map((overlay, index) => {
                        const isActive = isGuidedMode && index === currentFieldIndex;
                        const isHidden = isGuidedMode && index !== currentFieldIndex;
                        
                        // Parse coordinates (0-1000 scale)
                        const top = overlay.boundingBox.ymin / 10;
                        const left = overlay.boundingBox.xmin / 10;
                        const width = (overlay.boundingBox.xmax - overlay.boundingBox.xmin) / 10;
                        const height = (overlay.boundingBox.ymax - overlay.boundingBox.ymin) / 10;

                        if (isHidden) return null;

                        return (
                            <div
                                key={index}
                                className={`absolute border-2 flex items-center justify-center transition-all duration-300 ${isActive ? 'border-blue-500 bg-blue-500/10 z-20 animate-pulse-ring' : 'border-green-500 bg-green-500/10'}`}
                                style={{
                                    top: `${top}%`,
                                    left: `${left}%`,
                                    width: `${width}%`,
                                    height: `${height}%`,
                                }}
                            >
                                {!isGuidedMode && (
                                    <div className="absolute -top-8 left-1/2 transform -translate-x-1/2 bg-white text-slate-900 text-[10px] font-bold px-2 py-1 rounded shadow-md whitespace-nowrap z-10">
                                        {overlay.valueToFill}
                                    </div>
                                )}
                                {isActive && (
                                    <div className="absolute -top-12 left-1/2 transform -translate-x-1/2 bg-blue-600 text-white text-sm font-bold px-4 py-2 rounded-lg shadow-xl whitespace-nowrap z-30 animate-bounce">
                                        Write: {overlay.valueToFill}
                                    </div>
                                )}
                            </div>
                        );
                    })}
                </div>
             </div>
        )}

        {/* Scanning Animation */}
        {analyzing && (
           <div className="absolute inset-0 z-10">
              <div className="w-full h-1 bg-blue-500 shadow-[0_0_15px_rgba(59,130,246,1)] animate-[scan_2s_ease-in-out_infinite]" style={{ animationName: 'scan' }}></div>
              <div className="absolute inset-0 flex items-center justify-center">
                 <div className="bg-black/60 backdrop-blur-sm px-6 py-3 rounded-2xl text-white font-medium animate-pulse">
                    {t.analyzing}
                 </div>
              </div>
           </div>
        )}
        
        <style>{`
            @keyframes scan {
                0% { transform: translateY(0); }
                50% { transform: translateY(100vh); }
                100% { transform: translateY(0); }
            }
        `}</style>
      </div>

      {/* Bottom Controls */}
      <div className="p-6 pb-10 bg-gradient-to-t from-black to-transparent space-y-4">
         {!result && !analyzing && (
            <div className="flex flex-col items-center">
               <p className="text-white text-center mb-6 font-medium shadow-black drop-shadow-md">{t.pointAtForm}</p>
               <button 
                 onClick={captureAndAnalyze}
                 className="w-20 h-20 rounded-full border-4 border-white flex items-center justify-center mb-4 active:scale-95 transition-transform"
               >
                 <div className="w-16 h-16 bg-white rounded-full"></div>
               </button>
            </div>
         )}
         
         {result && (
             <div className="bg-white dark:bg-slate-800 rounded-3xl p-4 shadow-xl">
                 {/* Guided Controls */}
                 {isGuidedMode && (
                     <div className="flex items-center justify-between mb-4">
                         <button 
                            disabled={currentFieldIndex === 0}
                            onClick={() => setCurrentFieldIndex(Math.max(0, currentFieldIndex - 1))}
                            className="p-3 bg-slate-100 dark:bg-slate-700 rounded-full disabled:opacity-30"
                         >
                            <svg className="w-6 h-6 text-slate-600 dark:text-slate-300" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" /></svg>
                         </button>
                         <div className="text-center">
                             <p className="text-xs text-slate-400 font-bold uppercase">{t.step} {currentFieldIndex + 1} of {result.overlays.length}</p>
                             <p className="text-slate-900 dark:text-white font-bold text-lg">{result.overlays[currentFieldIndex]?.fieldName}</p>
                         </div>
                         <button 
                            disabled={currentFieldIndex === result.overlays.length - 1}
                            onClick={() => setCurrentFieldIndex(Math.min(result.overlays.length - 1, currentFieldIndex + 1))}
                            className="p-3 bg-blue-100 dark:bg-blue-900 rounded-full disabled:opacity-30"
                         >
                            <svg className="w-6 h-6 text-blue-600 dark:text-blue-300" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" /></svg>
                         </button>
                     </div>
                 )}

                 <div className="grid grid-cols-2 gap-3">
                     <button onClick={handleExplainForm} className="bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-300 py-3 rounded-xl font-bold text-sm">
                        {speaking ? 'Speaking...' : t.explainForm}
                     </button>
                     <button onClick={handleAskQuestion} className={`py-3 rounded-xl font-bold text-sm ${listening ? 'bg-red-100 text-red-600 animate-pulse' : 'bg-slate-100 dark:bg-slate-700 text-slate-700 dark:text-slate-300'}`}>
                        {listening ? t.listening : t.askQuestion}
                     </button>
                     <button onClick={() => setShowSaveTemplate(true)} className="bg-slate-100 dark:bg-slate-700 text-slate-700 dark:text-slate-300 py-3 rounded-xl font-bold text-sm">
                        {t.saveTemplate}
                     </button>
                     <button onClick={onComplete} className="bg-blue-600 text-white py-3 rounded-xl font-bold text-sm shadow-lg shadow-blue-500/30">
                        {t.done}
                     </button>
                 </div>
             </div>
         )}
      </div>

      {/* Save Template Dialog */}
      {showSaveTemplate && result && (
          <div className="absolute inset-0 bg-black/80 flex items-center justify-center p-6 z-50">
              <div className="bg-white dark:bg-slate-800 p-6 rounded-3xl w-full max-w-sm">
                  <h3 className="text-xl font-bold text-slate-900 dark:text-white mb-2">{t.saveTemplate}</h3>
                  <p className="text-slate-500 dark:text-slate-400 text-sm mb-4">{t.saveTemplateDesc}</p>
                  <input 
                    id="templateName"
                    placeholder={t.templateName}
                    className="w-full p-3 rounded-xl bg-slate-100 dark:bg-slate-900 text-slate-900 dark:text-white border-none focus:ring-2 focus:ring-blue-500 mb-4"
                  />
                  <div className="flex space-x-3">
                      <button onClick={() => setShowSaveTemplate(false)} className="flex-1 py-3 bg-slate-100 dark:bg-slate-700 rounded-xl font-bold text-slate-600 dark:text-slate-300">{t.cancel}</button>
                      <button 
                        onClick={() => {
                            const nameInput = document.getElementById('templateName') as HTMLInputElement;
                            const name = nameInput?.value?.trim() || `Form Template ${new Date().toLocaleDateString()}`;
                            onSaveTemplate(name, result.overlays);
                            setShowSaveTemplate(false);
                            alert('Template Saved!');
                        }} 
                        className="flex-1 py-3 bg-blue-600 text-white rounded-xl font-bold"
                      >
                          {t.save}
                      </button>
                  </div>
              </div>
          </div>
      )}
    </div>
  );
};

const Sidebar = ({ 
    isOpen, 
    onClose, 
    userProfile, 
    language,
    onNavigate,
    onToggleDarkMode,
    isDarkMode
}: { 
    isOpen: boolean; 
    onClose: () => void; 
    userProfile: UserProfile; 
    language: Language;
    onNavigate: (tab: DashboardTab) => void;
    onToggleDarkMode: () => void;
    isDarkMode: boolean;
}) => {
    const t = translations[language];
    if (!isOpen) return null;

    return (
        <div className="absolute inset-0 z-50 flex">
            <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={onClose}></div>
            <div className="relative w-3/4 max-w-xs h-full bg-white dark:bg-slate-900 shadow-2xl animate-slideRight flex flex-col">
                <div className="p-6 bg-blue-600 dark:bg-slate-800 text-white">
                    <div className="w-16 h-16 bg-white/20 rounded-full flex items-center justify-center text-2xl font-bold mb-3 border-2 border-white/30">
                        {userProfile.fullName.charAt(0)}
                    </div>
                    <h2 className="text-xl font-bold">{userProfile.fullName}</h2>
                    <div className="flex items-center text-blue-100 dark:text-blue-300 text-xs mt-1">
                        <svg className="w-3 h-3 mr-1" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" /></svg>
                        {t.verifiedUser}
                    </div>
                </div>
                
                <div className="flex-1 overflow-y-auto p-4 space-y-2">
                    <div className="text-xs font-bold text-slate-400 uppercase tracking-wider px-4 mt-2 mb-1">{t.menu}</div>
                    <button onClick={() => { onNavigate(DashboardTab.DOCUMENTS); onClose(); }} className="w-full flex items-center p-4 rounded-xl hover:bg-slate-50 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-200 font-medium transition-colors">
                        <span className="w-6 mr-3">📂</span> {t.idVault}
                    </button>
                    <button onClick={() => { onNavigate(DashboardTab.TEMPLATES); onClose(); }} className="w-full flex items-center p-4 rounded-xl hover:bg-slate-50 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-200 font-medium transition-colors">
                        <span className="w-6 mr-3">📄</span> {t.templates}
                    </button>
                    <button onClick={() => { onNavigate(DashboardTab.HISTORY); onClose(); }} className="w-full flex items-center p-4 rounded-xl hover:bg-slate-50 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-200 font-medium transition-colors">
                        <span className="w-6 mr-3">🕒</span> {t.history}
                    </button>
                    <button className="w-full flex items-center p-4 rounded-xl hover:bg-slate-50 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-200 font-medium transition-colors">
                        <span className="w-6 mr-3">☁️</span> {t.backupSecurity}
                    </button>

                    <div className="h-px bg-slate-100 dark:bg-slate-700 my-2"></div>

                    <div className="text-xs font-bold text-slate-400 uppercase tracking-wider px-4 mt-2 mb-1">{t.settings}</div>
                    <button className="w-full flex items-center p-4 rounded-xl hover:bg-slate-50 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-200 font-medium transition-colors">
                        <span className="w-6 mr-3">⚙️</span> {t.settings}
                    </button>
                    <div className="flex items-center justify-between p-4 rounded-xl hover:bg-slate-50 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-200 font-medium transition-colors">
                        <div className="flex items-center"><span className="w-6 mr-3">🌙</span> {t.darkMode}</div>
                        <div 
                           onClick={onToggleDarkMode} 
                           className={`w-12 h-6 rounded-full p-1 transition-colors cursor-pointer ${isDarkMode ? 'bg-blue-600' : 'bg-slate-300'}`}
                        >
                            <div className={`w-4 h-4 rounded-full bg-white transition-transform ${isDarkMode ? 'translate-x-6' : ''}`}></div>
                        </div>
                    </div>
                     <button className="w-full flex items-center p-4 rounded-xl hover:bg-slate-50 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-200 font-medium transition-colors">
                        <span className="w-6 mr-3">❓</span> {t.helpFaq}
                    </button>
                </div>
            </div>
        </div>
    );
}

const Dashboard = ({ 
  language, 
  userProfile, 
  onScan, 
  onReset, 
  onMagicEdit,
  onChangeLanguage,
  onAddDocument,
  onUpdateProfile,
  onSelectTemplate,
  formHistory,
  savedTemplates,
  isDarkMode,
  onToggleDarkMode
}: { 
  language: Language; 
  userProfile: UserProfile; 
  onScan: () => void;
  onReset: () => void;
  onMagicEdit: () => void;
  onChangeLanguage: () => void;
  onAddDocument: () => void;
  onUpdateProfile: (profile: UserProfile) => void;
  onSelectTemplate: (template: FormTemplate) => void;
  formHistory: FormRecord[];
  savedTemplates: FormTemplate[];
  isDarkMode: boolean;
  onToggleDarkMode: () => void;
}) => {
  const t = translations[language];
  const [activeTab, setActiveTab] = useState<DashboardTab>(DashboardTab.HOME);
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);

  // --- Views ---

  const HomeView = () => (
    <div className="flex-1 overflow-y-auto px-6 pt-6 pb-24 bg-slate-50 dark:bg-slate-900 transition-colors duration-300">
        {/* Header */}
        <div className="flex justify-between items-start mb-6">
            <div>
                <div className="flex items-center space-x-3 mb-1">
                   <button onClick={() => setIsSidebarOpen(true)} className="p-2 -ml-2 rounded-full hover:bg-slate-200 dark:hover:bg-slate-800 text-slate-900 dark:text-white">
                      <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h7" /></svg>
                   </button>
                   <h1 className="text-3xl font-bold text-slate-900 dark:text-white">{t.welcome}, {userProfile.fullName.split(' ')[0]}</h1>
                </div>
                <p className="text-slate-500 dark:text-slate-400">{t.readyToAutomate}</p>
            </div>
            <div className="w-10 h-10 bg-blue-100 dark:bg-blue-900/50 rounded-full flex items-center justify-center text-blue-600 dark:text-blue-300 font-bold border-2 border-white dark:border-slate-700 shadow-sm cursor-pointer" onClick={() => setActiveTab(DashboardTab.DOCUMENTS)}>
                {userProfile.fullName.charAt(0)}
            </div>
        </div>

        {/* Hero Card */}
        <div className="bg-gradient-to-br from-blue-600 to-indigo-700 rounded-[2rem] p-6 text-white shadow-xl shadow-blue-500/20 mb-8 relative overflow-hidden group">
            <div className="absolute top-0 right-0 w-32 h-32 bg-white/10 rounded-full -mr-10 -mt-10 blur-2xl"></div>
            <div className="absolute bottom-0 left-0 w-24 h-24 bg-purple-500/20 rounded-full -ml-10 -mb-10 blur-xl"></div>
            
            <div className="relative z-10 text-center py-4">
                <h2 className="text-2xl font-bold mb-6">{t.autoFillMagic}</h2>
                <button 
                  onClick={onScan}
                  className="bg-white text-blue-700 px-8 py-4 rounded-xl font-bold shadow-lg hover:scale-105 active:scale-95 transition-all w-full flex items-center justify-center"
                >
                   <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" /></svg>
                   {t.scanNewForm}
                </button>
            </div>
        </div>

        {/* Stats Grid */}
        <div className="grid grid-cols-2 gap-4 mb-8">
            <div className="bg-white dark:bg-slate-800 p-5 rounded-3xl shadow-sm border border-slate-100 dark:border-slate-700">
                <div className="flex justify-between items-start mb-4">
                    <span className="text-4xl font-bold text-slate-900 dark:text-white">{userProfile.documents?.length || 1}</span>
                    <div className="p-2 bg-green-50 dark:bg-green-900/30 rounded-full text-green-600 dark:text-green-400">
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                    </div>
                </div>
                <p className="text-slate-500 dark:text-slate-400 text-xs font-bold">{t.savedIds}</p>
            </div>
            <div className="bg-white dark:bg-slate-800 p-5 rounded-3xl shadow-sm border border-slate-100 dark:border-slate-700">
                <div className="flex justify-between items-start mb-4">
                    <span className="text-4xl font-bold text-slate-900 dark:text-white">{formHistory.length}</span>
                    <div className="p-2 bg-purple-50 dark:bg-purple-900/30 rounded-full text-purple-600 dark:text-purple-400">
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                    </div>
                </div>
                <p className="text-slate-500 dark:text-slate-400 text-xs font-bold">{t.formsFilled}</p>
            </div>
        </div>

        {/* Recent Forms */}
        <div className="flex items-center justify-between mb-4">
            <h3 className="font-bold text-lg text-slate-900 dark:text-white">{t.recentForms}</h3>
            <button onClick={() => setActiveTab(DashboardTab.HISTORY)} className="text-blue-600 dark:text-blue-400 text-sm font-semibold">{t.seeAll}</button>
        </div>
        <div className="space-y-3">
            {formHistory.slice(0, 2).map((form) => (
                <div key={form.id} className="bg-white dark:bg-slate-800 p-4 rounded-2xl flex items-center space-x-4 shadow-sm border border-slate-100 dark:border-slate-700">
                    <div className="w-12 h-12 bg-slate-100 dark:bg-slate-700 rounded-xl flex items-center justify-center text-2xl">📝</div>
                    <div>
                        <h4 className="font-bold text-slate-900 dark:text-white">Form #{form.id.slice(0,6)}</h4>
                        <p className="text-slate-400 text-xs">{new Date(form.date).toLocaleDateString()}</p>
                    </div>
                </div>
            ))}
             {formHistory.length === 0 && (
                <div className="text-center py-8 text-slate-400 text-sm">No recent forms. Scan one to get started!</div>
             )}
        </div>
    </div>
  );

  const DocumentsView = () => (
      <div className="flex-1 overflow-y-auto px-6 pt-6 pb-24 bg-slate-50 dark:bg-slate-900 transition-colors duration-300">
          <div className="flex items-center mb-6">
             <button onClick={() => setIsSidebarOpen(true)} className="p-2 -ml-2 rounded-full hover:bg-slate-200 dark:hover:bg-slate-800 text-slate-900 dark:text-white">
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h7" /></svg>
             </button>
             <h2 className="ml-2 text-2xl font-bold text-slate-900 dark:text-white">{t.myDocuments}</h2>
          </div>

          <div className="bg-white dark:bg-slate-800 p-6 rounded-[2rem] shadow-lg shadow-slate-200/50 dark:shadow-none mb-8 border border-slate-100 dark:border-slate-700 relative overflow-hidden">
              <div className="absolute top-0 right-0 w-32 h-32 bg-blue-50 dark:bg-blue-900/10 rounded-full -mr-10 -mt-10"></div>
              
              <div className="flex items-center space-x-4 mb-6 relative z-10">
                  <div className="w-16 h-16 bg-green-100 dark:bg-green-900/30 rounded-full flex items-center justify-center text-green-600 dark:text-green-400">
                      <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                  </div>
                  <div>
                      <h3 className="font-bold text-lg text-slate-900 dark:text-white">Aadhar Card</h3>
                      <p className="text-slate-400 text-sm">{userProfile.idNumber}</p>
                  </div>
              </div>

              <div className="space-y-4 relative z-10">
                  <div className="flex items-center space-x-3">
                      <div className="w-5 h-5 rounded-full bg-slate-100 dark:bg-slate-700 flex items-center justify-center text-xs text-slate-400">👤</div>
                      <span className="text-slate-700 dark:text-slate-300 font-medium">{userProfile.fullName}</span>
                  </div>
                  <div className="flex items-center space-x-3">
                       <div className="w-5 h-5 rounded-full bg-slate-100 dark:bg-slate-700 flex items-center justify-center text-xs text-slate-400">📅</div>
                      <span className="text-slate-700 dark:text-slate-300 font-medium">{userProfile.dateOfBirth}</span>
                  </div>
              </div>
          </div>

          <div className="mb-8">
              <h3 className="font-bold text-slate-900 dark:text-white mb-4">{t.personalInfo}</h3>
              <div className="bg-white dark:bg-slate-800 rounded-2xl p-4 space-y-4 border border-slate-100 dark:border-slate-700">
                  <div className="flex justify-between py-2 border-b border-slate-50 dark:border-slate-700">
                      <span className="text-slate-400 text-sm">{t.phone}</span>
                      <span className="text-slate-900 dark:text-white font-medium text-sm">{userProfile.phoneNumber}</span>
                  </div>
                  <div className="flex justify-between py-2 border-b border-slate-50 dark:border-slate-700">
                      <span className="text-slate-400 text-sm">{t.email}</span>
                      <span className="text-slate-900 dark:text-white font-medium text-sm">{userProfile.email}</span>
                  </div>
                   <div className="py-2">
                      <span className="text-slate-400 text-sm block mb-1">{t.address}</span>
                      <span className="text-slate-900 dark:text-white font-medium text-sm">{userProfile.address}</span>
                  </div>
                  <button onClick={onAddDocument} className="w-full py-3 mt-2 bg-slate-50 dark:bg-slate-700 text-blue-600 dark:text-blue-300 font-bold rounded-xl text-sm">
                      {t.edit}
                  </button>
              </div>
          </div>
          
           <div 
             onClick={onAddDocument}
             className="border-2 border-dashed border-slate-200 dark:border-slate-700 rounded-2xl p-6 flex flex-col items-center justify-center text-slate-400 hover:border-blue-400 hover:text-blue-500 transition-colors cursor-pointer"
           >
               <svg className="w-8 h-8 mb-2" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" /></svg>
               <span className="font-bold text-sm">{t.addNewDoc}</span>
           </div>
      </div>
  );

  const HistoryView = () => (
      <div className="flex-1 overflow-y-auto px-6 pt-6 pb-24 bg-slate-50 dark:bg-slate-900 transition-colors duration-300">
          <div className="flex items-center mb-6">
             <button onClick={() => setIsSidebarOpen(true)} className="p-2 -ml-2 rounded-full hover:bg-slate-200 dark:hover:bg-slate-800 text-slate-900 dark:text-white">
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h7" /></svg>
             </button>
             <h2 className="ml-2 text-2xl font-bold text-slate-900 dark:text-white">{t.history}</h2>
          </div>

          <div className="space-y-4">
               {formHistory.map((form) => (
                   <div key={form.id} className="bg-white dark:bg-slate-800 p-5 rounded-2xl flex items-center justify-between shadow-sm border border-slate-100 dark:border-slate-700">
                      <div className="flex items-center space-x-4">
                          <div className="w-10 h-10 rounded-full bg-blue-50 dark:bg-blue-900/20 flex items-center justify-center text-blue-600 dark:text-blue-400">
                              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>
                          </div>
                          <div>
                              <h4 className="font-bold text-slate-900 dark:text-white">Form #{form.id.slice(0,4)}</h4>
                              <p className="text-slate-400 text-xs">{new Date(form.date).toLocaleDateString()}</p>
                          </div>
                      </div>
                      <button className="text-slate-300 dark:text-slate-600">•••</button>
                   </div>
               ))}
          </div>
      </div>
  );

  return (
    <div className="flex flex-col h-full bg-slate-50 dark:bg-slate-900 transition-colors duration-300 overflow-hidden relative">
      <Sidebar 
         isOpen={isSidebarOpen} 
         onClose={() => setIsSidebarOpen(false)} 
         userProfile={userProfile} 
         language={language} 
         onNavigate={setActiveTab}
         isDarkMode={isDarkMode}
         onToggleDarkMode={onToggleDarkMode}
      />

      {activeTab === DashboardTab.HOME && <HomeView />}
      {activeTab === DashboardTab.DOCUMENTS && <DocumentsView />}
      {activeTab === DashboardTab.HISTORY && <HistoryView />}
      {activeTab === DashboardTab.TEMPLATES && <TemplatesView language={language} templates={savedTemplates} onSelectTemplate={onSelectTemplate} onOpenSidebar={() => setIsSidebarOpen(true)} />}

      {/* Bottom Nav */}
      <div className="absolute bottom-0 left-0 right-0 bg-white dark:bg-slate-800 border-t border-slate-100 dark:border-slate-700 p-4 pb-8 flex justify-around items-center z-10 rounded-t-[2rem] shadow-[0_-10px_40px_-15px_rgba(0,0,0,0.1)]">
        <button onClick={() => setActiveTab(DashboardTab.HOME)} className={`p-2 rounded-xl transition-all ${activeTab === DashboardTab.HOME ? 'bg-slate-100 dark:bg-slate-700 text-blue-600 dark:text-blue-400' : 'text-slate-400'}`}>
          <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" /></svg>
        </button>
        <button onClick={() => setActiveTab(DashboardTab.DOCUMENTS)} className={`p-2 rounded-xl transition-all ${activeTab === DashboardTab.DOCUMENTS ? 'bg-slate-100 dark:bg-slate-700 text-blue-600 dark:text-blue-400' : 'text-slate-400'}`}>
           <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>
        </button>
        
        {/* Floating Action Button */}
        <div className="relative -top-8">
            <button 
              onClick={onScan}
              className="w-16 h-16 bg-black dark:bg-blue-600 rounded-full flex items-center justify-center text-white shadow-2xl shadow-blue-500/40 hover:scale-110 transition-transform"
            >
               <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" /></svg>
            </button>
        </div>

        <button onClick={() => onMagicEdit()} className="p-2 text-slate-400 hover:text-purple-500 transition-colors">
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" /></svg>
        </button>
        <button onClick={() => setActiveTab(DashboardTab.HISTORY)} className={`p-2 rounded-xl transition-all ${activeTab === DashboardTab.HISTORY ? 'bg-slate-100 dark:bg-slate-700 text-blue-600 dark:text-blue-400' : 'text-slate-400'}`}>
           <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
        </button>
      </div>
    </div>
  );
};

const App = () => {
  const [language, setLanguage] = useState<Language>('en');
  const [view, setView] = useState<AppView>(AppView.LANGUAGE_SELECT);
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null);
  const [formHistory, setFormHistory] = useState<FormRecord[]>([]);
  const [savedTemplates, setSavedTemplates] = useState<FormTemplate[]>([]);
  const [selectedTemplate, setSelectedTemplate] = useState<FormTemplate | undefined>(undefined);
  const [isDarkMode, setIsDarkMode] = useState(false);

  // Sync dark mode class
  useEffect(() => {
    if (isDarkMode) {
        document.documentElement.classList.add('dark');
    } else {
        document.documentElement.classList.remove('dark');
    }
  }, [isDarkMode]);

  const handleProfileSaved = (profile: UserProfile) => {
    setUserProfile(profile);
    setView(AppView.DASHBOARD);
  };

  const handleScanComplete = () => {
      // Add to history
      const newRecord: FormRecord = {
          id: Math.random().toString(36).substr(2, 9),
          date: new Date().toISOString(),
          status: 'completed'
      };
      setFormHistory(prev => [newRecord, ...prev]);
      setView(AppView.DASHBOARD);
  };

  const handleSaveTemplate = (name: string, overlays: FormFieldOverlay[]) => {
      const newTemplate: FormTemplate = {
          id: Math.random().toString(36).substr(2, 9),
          name: name,
          createdAt: new Date().toISOString(),
          overlays: overlays
      };
      setSavedTemplates(prev => [...prev, newTemplate]);
  };

  const handleSelectTemplate = (template: FormTemplate) => {
      setSelectedTemplate(template);
      setView(AppView.SCANNER);
  };

  if (view === AppView.LANGUAGE_SELECT) {
    return (
      <>
        <GlobalStyles />
        <LanguageSelector onSelect={(lang) => { setLanguage(lang); setView(AppView.ONBOARDING); }} />
      </>
    );
  }

  if (view === AppView.ONBOARDING) {
    return (
      <>
        <GlobalStyles />
        <Onboarding 
            language={language} 
            onProfileSaved={handleProfileSaved} 
            initialProfile={userProfile || undefined}
            onCancel={userProfile ? () => setView(AppView.DASHBOARD) : undefined}
        />
      </>
    );
  }

  if (view === AppView.SCANNER && userProfile) {
    return (
      <>
        <GlobalStyles />
        <Scanner 
            language={language} 
            userProfile={userProfile} 
            onClose={() => { setSelectedTemplate(undefined); setView(AppView.DASHBOARD); }}
            onComplete={handleScanComplete}
            onSaveTemplate={handleSaveTemplate}
            initialTemplate={selectedTemplate}
        />
      </>
    );
  }

  if (view === AppView.IMAGE_EDITOR) {
      return (
          <>
            <GlobalStyles />
            <MagicEditor language={language} onClose={() => setView(AppView.DASHBOARD)} />
          </>
      );
  }

  if (view === AppView.DASHBOARD && userProfile) {
    return (
      <>
        <GlobalStyles />
        <Dashboard 
          language={language} 
          userProfile={userProfile} 
          onScan={() => { setSelectedTemplate(undefined); setView(AppView.SCANNER); }}
          onReset={() => setView(AppView.ONBOARDING)}
          onMagicEdit={() => setView(AppView.IMAGE_EDITOR)}
          onChangeLanguage={() => setView(AppView.LANGUAGE_SELECT)}
          onAddDocument={() => setView(AppView.ONBOARDING)}
          onUpdateProfile={(p) => setUserProfile(p)}
          formHistory={formHistory}
          savedTemplates={savedTemplates}
          onSelectTemplate={handleSelectTemplate}
          isDarkMode={isDarkMode}
          onToggleDarkMode={() => setIsDarkMode(!isDarkMode)}
        />
      </>
    );
  }

  return null;
};

export default App;
