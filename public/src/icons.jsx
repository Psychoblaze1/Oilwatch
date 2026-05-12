// ============================================================
// Icons — minimal stroke set
// ============================================================
const Icon = ({ name, size = 16, stroke = 1.6, ...rest }) => {
  const s = { width: size, height: size, ...rest.style };
  const common = {
    width: size, height: size, viewBox: "0 0 24 24", fill: "none",
    stroke: "currentColor", strokeWidth: stroke, strokeLinecap: "round", strokeLinejoin: "round",
    ...rest,
  };
  switch (name) {
    case "dashboard":  return (<svg {...common}><rect x="3" y="3" width="7" height="9"/><rect x="14" y="3" width="7" height="5"/><rect x="14" y="12" width="7" height="9"/><rect x="3" y="16" width="7" height="5"/></svg>);
    case "samples":    return (<svg {...common}><path d="M9 3h6v4l3 6v8a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2v-8l3-6z"/><path d="M6 14h12"/></svg>);
    case "assets":     return (<svg {...common}><rect x="3" y="3" width="8" height="8"/><rect x="13" y="3" width="8" height="8"/><rect x="3" y="13" width="8" height="8"/><circle cx="17" cy="17" r="4"/></svg>);
    case "lifecycle":  return (<svg {...common}><path d="M3 6h4l2 12h6l2-12h4"/><path d="M9 6V3h6v3"/></svg>);
    case "ai":         return (<svg {...common}><path d="M12 3l1.6 4.2L18 9l-4.4 1.8L12 15l-1.6-4.2L6 9l4.4-1.8z"/><path d="M19 16l.7 1.8L21.5 18.5l-1.8.7L19 21l-.7-1.8L16.5 18.5l1.8-.7z"/></svg>);
    case "ref":        return (<svg {...common}><path d="M4 4h12a2 2 0 0 1 2 2v14H6a2 2 0 0 1-2-2V4z"/><path d="M8 8h6M8 12h6M8 16h4"/></svg>);
    case "alarm":      return (<svg {...common}><path d="M12 3a6 6 0 0 0-6 6v3l-2 4h16l-2-4V9a6 6 0 0 0-6-6z"/><path d="M10 20a2 2 0 0 0 4 0"/></svg>);
    case "search":     return (<svg {...common}><circle cx="11" cy="11" r="7"/><path d="M21 21l-4.3-4.3"/></svg>);
    case "send":       return (<svg {...common}><path d="M3 11L21 3l-7 18-3-8z"/></svg>);
    case "chevron":    return (<svg {...common}><path d="M6 9l6 6 6-6"/></svg>);
    case "chevron-r":  return (<svg {...common}><path d="M9 6l6 6-6 6"/></svg>);
    case "chevron-l":  return (<svg {...common}><path d="M15 6l-6 6 6 6"/></svg>);
    case "close":      return (<svg {...common}><path d="M6 6l12 12M6 18L18 6"/></svg>);
    case "plus":       return (<svg {...common}><path d="M12 5v14M5 12h14"/></svg>);
    case "check":      return (<svg {...common}><path d="M5 12l5 5 9-11"/></svg>);
    case "barcode":    return (<svg {...common}><path d="M4 5v14M7 5v14M10 5v14M13 5v14M16 5v14M19 5v14"/></svg>);
    case "filter":     return (<svg {...common}><path d="M3 5h18l-7 9v5l-4 2v-7z"/></svg>);
    case "download":   return (<svg {...common}><path d="M12 4v12m0 0l-4-4m4 4l4-4M4 20h16"/></svg>);
    case "spark":      return (<svg {...common}><path d="M12 2v4M12 18v4M2 12h4M18 12h4M5 5l3 3M16 16l3 3M19 5l-3 3M8 16l-3 3"/></svg>);
    case "user":       return (<svg {...common}><circle cx="12" cy="8" r="4"/><path d="M4 21a8 8 0 0 1 16 0"/></svg>);
    case "site":       return (<svg {...common}><path d="M3 21h18M5 21V8l7-4 7 4v13"/><path d="M9 21v-6h6v6"/></svg>);
    case "dot":        return (<svg {...common}><circle cx="12" cy="12" r="3" fill="currentColor"/></svg>);
    case "more":       return (<svg {...common}><circle cx="5" cy="12" r="1" fill="currentColor"/><circle cx="12" cy="12" r="1" fill="currentColor"/><circle cx="19" cy="12" r="1" fill="currentColor"/></svg>);
    case "arrow-up":   return (<svg {...common}><path d="M12 19V5M5 12l7-7 7 7"/></svg>);
    case "arrow-dn":   return (<svg {...common}><path d="M12 5v14M5 12l7 7 7-7"/></svg>);
    case "info":       return (<svg {...common}><circle cx="12" cy="12" r="9"/><path d="M12 11v5M12 8h.01"/></svg>);
    case "settings":   return (<svg {...common}><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z"/></svg>);
    case "sun":        return (<svg {...common}><circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M4.93 19.07l1.41-1.41M17.66 6.34l1.41-1.41"/></svg>);
    case "moon":       return (<svg {...common}><path d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8z"/></svg>);
    case "limits":     return (<svg {...common}><path d="M4 6h10M18 6h2"/><circle cx="16" cy="6" r="2"/><path d="M4 12h2M10 12h10"/><circle cx="8" cy="12" r="2"/><path d="M4 18h14M22 18h0"/><circle cx="20" cy="18" r="2"/></svg>);
    case "rules":      return (<svg {...common}><path d="M9 6l2 2 4-4"/><path d="M9 12l2 2 4-4"/><path d="M9 18l2 2 4-4"/><path d="M3 6h2M3 12h2M3 18h2"/></svg>);
    case "trash":      return (<svg {...common}><path d="M4 7h16M9 7V4h6v3M6 7l1 13h10l1-13M10 11v6M14 11v6"/></svg>);
    default:           return null;
  }
};

window.Icon = Icon;
