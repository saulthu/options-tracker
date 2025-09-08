"use client";

import { useState, useEffect, useRef } from "react";
import { Plus, Grid3X3, Calendar, Activity, TrendingUp, Brain, Settings, User, LogOut, LucideIcon, List } from "lucide-react";
import Image from "next/image";
import { ViewType } from "@/types/navigation";
import { useTimeRange } from "@/contexts/TimeRangeContext";

import TimeRangeSelector from "@/components/TimeRangeSelector";

interface SidebarProps {
  children: React.ReactNode;
  onViewChange: (view: ViewType) => void;
  currentView: ViewType;
  onLogout: () => void;
  userProfile?: {
    name: string;
    email: string;
  } | null;
}

interface NavButtonProps {
  icon: LucideIcon;
  text: string;
  isCollapsed: boolean;
  hoveredButton: string | null;
  buttonKey: string;
  isActive?: boolean;
  onClick?: () => void;
  onMouseEnter: () => void;
  onMouseLeave: () => void;
}

// Reusable navigation button component
function NavButton({ 
  icon: Icon, 
  text, 
  isCollapsed, 
  hoveredButton, 
  buttonKey, 
  isActive = false, 
  onClick,
  onMouseEnter,
  onMouseLeave 
}: NavButtonProps) {
  // DRY: Use computed classes from parent component
  const buttonWidthClass = isCollapsed ? 'sidebar-button-width-collapsed' : 'sidebar-button-width-expanded';
  const iconPositionClass = isCollapsed ? 'sidebar-icon-collapsed' : 'sidebar-icon-expanded';
  const textVisibilityClass = isCollapsed ? 'sidebar-text-collapsed' : 'sidebar-text-expanded';
  
  return (
    <button 
      className={`sidebar-nav-item ${buttonWidthClass} ${isActive ? 'sidebar-nav-item-active' : ''}`}
      onMouseEnter={onMouseEnter}
      onMouseLeave={onMouseLeave}
      onClick={onClick}
    >
      <div className={`sidebar-icon-container ${iconPositionClass}`}>
        <Icon size={20} />
      </div>
      <span className={`ml-3 ${textVisibilityClass}`}>{text}</span>
      
      {/* Hover tooltip for collapsed state */}
      {isCollapsed && hoveredButton === buttonKey && (
        <div className="sidebar-tooltip">
          {text}
        </div>
      )}
    </button>
  );
}

export default function Sidebar({ children, onViewChange, currentView, onLogout, userProfile }: SidebarProps) {
  const { selectedRange, handleRangeChange } = useTimeRange();
  const [isCollapsed, setIsCollapsed] = useState(false);
  const [hoveredButton, setHoveredButton] = useState<string | null>(null);
  const [showUserMenu, setShowUserMenu] = useState(false);
  const userMenuRef = useRef<HTMLDivElement>(null);

  // DRY: Computed CSS classes to avoid repeated ternaries
  const sidebarWidthClass = isCollapsed ? 'sidebar-width-collapsed' : 'sidebar-width-expanded';
  const navContainerClass = isCollapsed ? 'sidebar-nav-container-collapsed' : 'sidebar-nav-container-expanded';
  const userTextClass = isCollapsed ? 'sidebar-user-text-collapsed' : 'sidebar-user-text-expanded';

  // DRY: Reusable mouse event handlers
  const handleMouseEnter = (key: string) => {
    if (isCollapsed) setHoveredButton(key);
  };

  const handleMouseLeave = () => setHoveredButton(null);

  // Handle clicking outside the user menu
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      // Don't close if clicking on the user icon itself
      const target = event.target as Node;
      const userIcon = document.querySelector('[data-user-icon]');
      
      if (userMenuRef.current && !userMenuRef.current.contains(target) && 
          userIcon && !userIcon.contains(target)) {
        closeUserMenu();
      }
    };

    if (showUserMenu) {
      document.addEventListener('mousedown', handleClickOutside);
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [showUserMenu]);

  const toggleSidebar = () => {
    setIsCollapsed(!isCollapsed);
  };

  const handleViewChange = (view: ViewType) => {
    onViewChange(view);
    closeUserMenu(); // Close menu when navigating
  };

  const handleLogout = () => {
    onLogout();
    closeUserMenu();
  };

  const toggleUserMenu = () => {
    setShowUserMenu(prev => !prev);
  };

  const closeUserMenu = () => {
    setShowUserMenu(false);
  };

  // DRY: Dynamic navigation items configuration
  const navItems = [
    { key: 'quick-add', icon: Plus, text: 'Quick Add' },
    { key: 'overview', icon: Grid3X3, text: 'Overview', hasAction: true },
    { key: 'weekly-report', icon: Calendar, text: 'Report', hasAction: true },

    { key: 'shares', icon: TrendingUp, text: 'Shares', hasAction: true },
    { key: 'options', icon: Activity, text: 'Options', hasAction: true },
    { key: 'transactions', icon: List, text: 'Positions', hasAction: true },
    { key: 'ai-assistant', icon: Brain, text: 'AI Assistant' },
    { key: 'settings', icon: Settings, text: 'Settings', hasAction: true },
  ].map(item => ({
    ...item,
    onClick: item.hasAction ? () => handleViewChange(item.key as ViewType) : undefined,
    isActive: item.hasAction ? currentView === item.key : false
  }));

  return (
    <div className="flex h-screen bg-[#0f0f0f]">
      {/* Sidebar */}
      <div className={`bg-[#1a1a1a] text-white ${sidebarWidthClass}`}>
        {/* Header */}
        <div className="border-b border-[#2d2d2d] py-4 px-2">
          <div className="flex items-center">
            <div className="w-12 h-12 flex items-center justify-center cursor-pointer" onClick={toggleSidebar}>
              <Image src="/td.avif" alt="TD Logo" width={48} height={48} className="object-contain rounded-full" />
            </div>
          </div>
        </div>

        {/* Navigation */}
        <div className={navContainerClass}>
          <nav>
            {navItems.map((item) => (
              <NavButton
                key={item.key}
                icon={item.icon}
                text={item.text}
                isCollapsed={isCollapsed}
                hoveredButton={hoveredButton}
                buttonKey={item.key}
                isActive={item.isActive}
                onClick={item.onClick}
                onMouseEnter={() => handleMouseEnter(item.key)}
                onMouseLeave={handleMouseLeave}
              />
            ))}
          </nav>
        </div>

        {/* Time Range Selector - Below Navigation */}
        {!isCollapsed && (
          <div className="px-2 py-3 border-t border-[#2d2d2d]">
            <TimeRangeSelector
              onRangeChange={handleRangeChange}
              initialScale="week"
              selectedRange={selectedRange}
            />
          </div>
        )}

        {/* User Info with Popup Menu */}
        <div className="absolute bottom-0 left-0 right-0 p-4">
          <div className="relative">
            <div className="flex items-center space-x-3">
              <div 
                className="sidebar-user-icon"
                data-user-icon
                onClick={toggleUserMenu}
                onMouseEnter={() => handleMouseEnter('user')}
                onMouseLeave={handleMouseLeave}
              >
                <User size={20} className="text-[#b3b3b3]" />
                
                {/* Hover tooltip for collapsed state */}
                {isCollapsed && hoveredButton === 'user' && (
                  <div className="sidebar-tooltip">
                    User Menu
                  </div>
                )}
              </div>
              <div className={`flex-1 min-w-0 ${userTextClass}`}>
                <div className="text-white text-sm font-medium truncate">
                  {userProfile?.name || 'User'}
                </div>
              </div>
            </div>

            {/* User Menu Popup */}
            {showUserMenu && (
              <div className="sidebar-user-menu-popup" ref={userMenuRef}>
                <div className="py-2">
                  {/* Logout Button */}
                  <button
                    className="sidebar-user-menu-button"
                    onClick={handleLogout}
                  >
                    <LogOut size={16} className="mr-3" />
                    Logout
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Page Content */}
        <div className="flex-1 overflow-auto bg-[#0f0f0f]">
          {children}
        </div>
      </div>
    </div>
  );
}
