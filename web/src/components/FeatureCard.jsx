import React from "react";

export default function FeatureCard({ title, description, icon }) {
  return (
    <div className="group relative bg-white border border-slate-100 rounded-[2rem] p-8 shadow-lg shadow-slate-200/50 transition-all duration-300 hover:-translate-y-2 hover:shadow-2xl hover:shadow-blue-500/10 hover:border-blue-200 cursor-default overflow-hidden">
      
      <div className="absolute inset-0 bg-gradient-to-br from-blue-50/50 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500 pointer-events-none"></div>

      <div className="relative z-10">
        <div className="w-14 h-14 mb-6 rounded-2xl bg-blue-50 flex items-center justify-center text-3xl text-blue-600 shadow-sm group-hover:bg-blue-600 group-hover:text-white group-hover:scale-110 transition-all duration-300">
          {icon || ""} 
        </div>

        <h4 className="text-xl font-extrabold text-slate-900 mb-3 group-hover:text-blue-600 transition-colors duration-300">
          {title}
        </h4>

        <p className="text-slate-500 text-sm leading-relaxed font-medium">
          {description}
        </p>
      </div>
    </div>
  );
}