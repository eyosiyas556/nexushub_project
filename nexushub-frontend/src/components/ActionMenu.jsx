import React, { useState, useRef, useEffect } from "react";

/**
 * ActionMenu - A modern 3-dots action menu with an eye-friendly dropdown.
 *
 * @param {Array} actions - Array of action objects:
 *   [
 *     {
 *       label: string,
 *       icon: ReactNode,
 *       onClick: function,
 *       danger?: boolean,
 *       disabled?: boolean
 *     }
 *   ]
 * @param {string} align - Dropdown alignment ('right' | 'left', default 'right')
 */
export default function ActionMenu({ actions = [], align = "right", ariaLabel = "Row actions" }) {
  const [isOpen, setIsOpen] = useState(false);
  const [openUpward, setOpenUpward] = useState(false);
  const menuRef = useRef(null);
  const buttonRef = useRef(null);

  // Filter out any null/undefined/falsy actions
  const validActions = actions.filter(Boolean);

  const toggleMenu = (e) => {
    e.stopPropagation();
    if (!isOpen && buttonRef.current) {
      const rect = buttonRef.current.getBoundingClientRect();
      const spaceBelow = window.innerHeight - rect.bottom;
      // If less than 170px below, flip menu upwards
      setOpenUpward(spaceBelow < 170);
    }
    setIsOpen((prev) => !prev);
  };

  const handleActionClick = (e, action) => {
    e.stopPropagation();
    if (action.disabled) return;
    setIsOpen(false);
    if (typeof action.onClick === "function") {
      action.onClick();
    }
  };

  // Close on outside click
  useEffect(() => {
    if (!isOpen) return;

    const handleClickOutside = (event) => {
      if (
        menuRef.current &&
        !menuRef.current.contains(event.target) &&
        buttonRef.current &&
        !buttonRef.current.contains(event.target)
      ) {
        setIsOpen(false);
      }
    };

    const handleKeyDown = (event) => {
      if (event.key === "Escape") {
        setIsOpen(false);
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    document.addEventListener("touchstart", handleClickOutside);
    document.addEventListener("keydown", handleKeyDown);

    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
      document.removeEventListener("touchstart", handleClickOutside);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [isOpen]);

  if (validActions.length === 0) return null;

  return (
    <div className="relative inline-block text-left" ref={menuRef}>
      <button
        ref={buttonRef}
        type="button"
        onClick={toggleMenu}
        aria-expanded={isOpen}
        aria-label={ariaLabel}
        title="More actions"
        className={`inline-flex items-center justify-center w-8 h-8 rounded-xl transition-all cursor-pointer focus:outline-none focus:ring-2 focus:ring-slate-400/40 border active:scale-95 shadow-xs ${
          isOpen
            ? "bg-[#0F172A] text-white border-[#0F172A] shadow-sm"
            : "text-slate-800 bg-slate-100/80 hover:bg-slate-200/90 hover:text-black border-slate-200/90"
        }`}
      >
        <svg
          className="w-4 h-4 fill-current shrink-0"
          viewBox="0 0 20 20"
          aria-hidden="true"
        >
          <circle cx="10" cy="4" r="2.2" />
          <circle cx="10" cy="10" r="2.2" />
          <circle cx="10" cy="16" r="2.2" />
        </svg>
      </button>

      {isOpen && (
        <div
          role="menu"
          className={`absolute ${
            align === "right" ? "right-0" : "left-0"
          } ${
            openUpward ? "bottom-full mb-1.5" : "top-full mt-1.5"
          } w-44 min-w-[170px] bg-white rounded-2xl border border-slate-200/90 shadow-xl py-1.5 z-50 animate-in fade-in zoom-in-95 duration-150`}
        >
          {validActions.map((action, idx) => (
            <button
              key={idx}
              type="button"
              role="menuitem"
              disabled={action.disabled}
              onClick={(e) => handleActionClick(e, action)}
              className={`w-full text-left px-3.5 py-2.5 flex items-center gap-2.5 text-xs font-medium transition cursor-pointer ${
                action.disabled
                  ? "opacity-40 cursor-not-allowed text-slate-400"
                  : action.danger
                  ? "text-rose-600 hover:bg-rose-50/80 hover:text-rose-700"
                  : "text-slate-700 hover:bg-slate-50 hover:text-[#0F172A]"
              }`}
            >
              {action.icon && (
                <span className="shrink-0 flex items-center justify-center text-inherit">
                  {action.icon}
                </span>
              )}
              <span className="truncate">{action.label}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
