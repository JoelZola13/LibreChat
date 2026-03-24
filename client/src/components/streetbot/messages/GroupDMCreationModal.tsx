"use client";

import React, { useState, useEffect, useRef } from "react";
import { X, Search, Users, Check, Plus, Camera } from "lucide-react";

type User = {
  id: string;
  name: string;
  avatar?: string;
  status?: "online" | "offline" | "away";
};

interface GroupDMCreationModalProps {
  currentUserId: string;
  availableUsers: User[];
  onClose: () => void;
  onCreate: (participants: string[], name?: string) => void;
  colors: {
    surface: string;
    surfaceHover: string;
    border: string;
    text: string;
    textSecondary: string;
    textMuted: string;
    accent: string;
    success: string;
  };
}

export function GroupDMCreationModal({
  currentUserId,
  availableUsers,
  onClose,
  onCreate,
  colors,
}: GroupDMCreationModalProps) {
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedUsers, setSelectedUsers] = useState<User[]>([]);
  const [groupName, setGroupName] = useState("");
  const [step, setStep] = useState<"select" | "configure">("select");
  const modalRef = useRef<HTMLDivElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);

  // Filter out current user and already selected users
  const filteredUsers = availableUsers
    .filter((u) => u.id !== currentUserId)
    .filter((u) => !selectedUsers.some((s) => s.id === u.id))
    .filter((u) => {
      if (!searchQuery.trim()) return true;
      const query = searchQuery.toLowerCase();
      return u.name.toLowerCase().includes(query) || u.id.toLowerCase().includes(query);
    });

  // Close on click outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (modalRef.current && !modalRef.current.contains(e.target as Node)) {
        onClose();
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [onClose]);

  // Close on escape
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [onClose]);

  // Focus search on mount
  useEffect(() => {
    searchInputRef.current?.focus();
  }, []);

  const toggleUser = (user: User) => {
    if (selectedUsers.some((u) => u.id === user.id)) {
      setSelectedUsers((prev) => prev.filter((u) => u.id !== user.id));
    } else {
      setSelectedUsers((prev) => [...prev, user]);
    }
  };

  const handleCreate = () => {
    const participants = [currentUserId, ...selectedUsers.map((u) => u.id)];
    onCreate(participants, groupName.trim() || undefined);
  };

  const canCreate = selectedUsers.length >= 1;
  const isGroup = selectedUsers.length >= 2;

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        background: "rgba(0,0,0,0.6)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        zIndex: 1000,
      }}
    >
      <div
        ref={modalRef}
        style={{
          width: "440px",
          maxHeight: "600px",
          background: colors.surface,
          backdropFilter: "blur(20px) saturate(180%)",
          WebkitBackdropFilter: "blur(20px) saturate(180%)",
          border: `1px solid ${colors.border}`,
          borderRadius: "16px",
          boxShadow: "0 20px 60px rgba(0,0,0,0.4)",
          display: "flex",
          flexDirection: "column",
          overflow: "hidden",
        }}
      >
        {/* Header */}
        <div
          style={{
            padding: "16px",
            borderBottom: `1px solid ${colors.border}`,
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
            <Users size={20} color={colors.accent} />
            <h3 style={{ margin: 0, fontSize: "1rem", fontWeight: 600, color: colors.text }}>
              {step === "select" ? "New Message" : "Group Details"}
            </h3>
          </div>
          <button
            onClick={onClose}
            style={{
              width: "28px",
              height: "28px",
              borderRadius: "6px",
              border: "none",
              background: "transparent",
              cursor: "pointer",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              color: colors.textSecondary,
            }}
          >
            <X size={16} />
          </button>
        </div>

        {step === "select" ? (
          <>
            {/* Selected users */}
            {selectedUsers.length > 0 && (
              <div
                style={{
                  padding: "12px",
                  borderBottom: `1px solid ${colors.border}`,
                  display: "flex",
                  flexWrap: "wrap",
                  gap: "8px",
                }}
              >
                {selectedUsers.map((user) => (
                  <div
                    key={user.id}
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: "6px",
                      padding: "4px 10px 4px 4px",
                      borderRadius: "20px",
                      background: `${colors.accent}20`,
                      border: `1px solid ${colors.accent}40`,
                    }}
                  >
                    <div
                      style={{
                        width: "24px",
                        height: "24px",
                        borderRadius: "50%",
                        background: user.avatar || colors.accent,
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        fontSize: "0.7rem",
                        fontWeight: 600,
                        color: "#000",
                      }}
                    >
                      {user.name.charAt(0).toUpperCase()}
                    </div>
                    <span style={{ fontSize: "0.875rem", color: colors.text }}>{user.name}</span>
                    <button
                      onClick={() => toggleUser(user)}
                      style={{
                        width: "16px",
                        height: "16px",
                        borderRadius: "50%",
                        border: "none",
                        background: colors.textMuted,
                        cursor: "pointer",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        marginLeft: "4px",
                      }}
                    >
                      <X size={10} color="#fff" />
                    </button>
                  </div>
                ))}
              </div>
            )}

            {/* Search */}
            <div style={{ padding: "12px" }}>
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: "8px",
                  background: colors.surfaceHover,
                  borderRadius: "8px",
                  padding: "10px 12px",
                }}
              >
                <Search size={16} color={colors.textMuted} />
                <input
                  ref={searchInputRef}
                  type="text"
                  placeholder="Search people..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  style={{
                    flex: 1,
                    background: "transparent",
                    border: "none",
                    outline: "none",
                    color: colors.text,
                    fontSize: "0.875rem",
                  }}
                />
              </div>
            </div>

            {/* User list */}
            <div style={{ flex: 1, overflow: "auto", padding: "0 8px 8px" }}>
              {filteredUsers.length === 0 ? (
                <div
                  style={{
                    textAlign: "center",
                    color: colors.textSecondary,
                    padding: "24px",
                    fontSize: "0.875rem",
                  }}
                >
                  {searchQuery ? "No users found" : "No more users to add"}
                </div>
              ) : (
                filteredUsers.map((user) => {
                  const isSelected = selectedUsers.some((u) => u.id === user.id);
                  return (
                    <button
                      key={user.id}
                      onClick={() => toggleUser(user)}
                      style={{
                        width: "100%",
                        display: "flex",
                        alignItems: "center",
                        gap: "12px",
                        padding: "10px 12px",
                        borderRadius: "8px",
                        border: "none",
                        background: isSelected ? `${colors.accent}20` : "transparent",
                        cursor: "pointer",
                        textAlign: "left",
                        transition: "background 0.15s",
                      }}
                      onMouseEnter={(e) => {
                        if (!isSelected) {
                          e.currentTarget.style.background = colors.surfaceHover;
                        }
                      }}
                      onMouseLeave={(e) => {
                        if (!isSelected) {
                          e.currentTarget.style.background = "transparent";
                        }
                      }}
                    >
                      {/* Avatar with status */}
                      <div style={{ position: "relative" }}>
                        <div
                          style={{
                            width: "40px",
                            height: "40px",
                            borderRadius: "10px",
                            background: user.avatar || colors.accent,
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "center",
                            fontSize: "1rem",
                            fontWeight: 600,
                            color: "#000",
                          }}
                        >
                          {user.name.charAt(0).toUpperCase()}
                        </div>
                        {user.status && (
                          <div
                            style={{
                              position: "absolute",
                              bottom: -2,
                              right: -2,
                              width: "12px",
                              height: "12px",
                              borderRadius: "50%",
                              background:
                                user.status === "online"
                                  ? colors.success
                                  : user.status === "away"
                                  ? "#FFAA00"
                                  : colors.textMuted,
                              border: `2px solid ${colors.surface}`,
                            }}
                          />
                        )}
                      </div>

                      {/* User info */}
                      <div style={{ flex: 1 }}>
                        <div style={{ fontWeight: 500, color: colors.text }}>{user.name}</div>
                        <div style={{ fontSize: "0.75rem", color: colors.textMuted }}>@{user.id}</div>
                      </div>

                      {/* Checkbox */}
                      <div
                        style={{
                          width: "22px",
                          height: "22px",
                          borderRadius: "6px",
                          border: `2px solid ${isSelected ? colors.accent : colors.border}`,
                          background: isSelected ? colors.accent : "transparent",
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                          transition: "all 0.15s",
                        }}
                      >
                        {isSelected && <Check size={14} color="#000" strokeWidth={3} />}
                      </div>
                    </button>
                  );
                })
              )}
            </div>
          </>
        ) : (
          /* Configure step for group */
          <div style={{ padding: "16px", flex: 1 }}>
            {/* Group avatar */}
            <div
              style={{
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                marginBottom: "24px",
              }}
            >
              <div
                style={{
                  width: "80px",
                  height: "80px",
                  borderRadius: "20px",
                  background: colors.surfaceHover,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  cursor: "pointer",
                  border: `2px dashed ${colors.border}`,
                  marginBottom: "8px",
                }}
              >
                <Camera size={32} color={colors.textMuted} />
              </div>
              <span style={{ fontSize: "0.75rem", color: colors.textMuted }}>
                Add group photo (optional)
              </span>
            </div>

            {/* Group name */}
            <div style={{ marginBottom: "24px" }}>
              <label
                style={{
                  display: "block",
                  fontSize: "0.75rem",
                  color: colors.textSecondary,
                  marginBottom: "8px",
                  textTransform: "uppercase",
                  letterSpacing: "0.5px",
                }}
              >
                Group Name
              </label>
              <input
                type="text"
                placeholder="Enter group name..."
                value={groupName}
                onChange={(e) => setGroupName(e.target.value)}
                style={{
                  width: "100%",
                  padding: "12px",
                  borderRadius: "8px",
                  border: `1px solid ${colors.border}`,
                  background: colors.surfaceHover,
                  color: colors.text,
                  fontSize: "0.875rem",
                  outline: "none",
                }}
              />
            </div>

            {/* Members preview */}
            <div>
              <label
                style={{
                  display: "block",
                  fontSize: "0.75rem",
                  color: colors.textSecondary,
                  marginBottom: "8px",
                  textTransform: "uppercase",
                  letterSpacing: "0.5px",
                }}
              >
                Members ({selectedUsers.length + 1})
              </label>
              <div style={{ display: "flex", flexWrap: "wrap", gap: "8px" }}>
                {/* Current user */}
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: "6px",
                    padding: "6px 10px",
                    borderRadius: "8px",
                    background: colors.surfaceHover,
                    fontSize: "0.875rem",
                    color: colors.text,
                  }}
                >
                  You
                </div>
                {selectedUsers.map((user) => (
                  <div
                    key={user.id}
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: "6px",
                      padding: "6px 10px",
                      borderRadius: "8px",
                      background: colors.surfaceHover,
                      fontSize: "0.875rem",
                      color: colors.text,
                    }}
                  >
                    {user.name}
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* Footer */}
        <div
          style={{
            padding: "12px 16px",
            borderTop: `1px solid ${colors.border}`,
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
          }}
        >
          {step === "configure" ? (
            <button
              onClick={() => setStep("select")}
              style={{
                padding: "10px 16px",
                borderRadius: "8px",
                border: `1px solid ${colors.border}`,
                background: "transparent",
                color: colors.textSecondary,
                cursor: "pointer",
                fontSize: "0.875rem",
              }}
            >
              Back
            </button>
          ) : (
            <div style={{ fontSize: "0.75rem", color: colors.textMuted }}>
              {selectedUsers.length === 0
                ? "Select at least 1 person"
                : selectedUsers.length === 1
                ? "1 person selected"
                : `${selectedUsers.length} people selected`}
            </div>
          )}

          <button
            onClick={() => {
              if (step === "select" && isGroup) {
                setStep("configure");
              } else {
                handleCreate();
              }
            }}
            disabled={!canCreate}
            style={{
              padding: "10px 20px",
              borderRadius: "8px",
              border: "none",
              background: canCreate ? colors.accent : colors.surfaceHover,
              color: canCreate ? "#000" : colors.textMuted,
              cursor: canCreate ? "pointer" : "not-allowed",
              fontSize: "0.875rem",
              fontWeight: 600,
              display: "flex",
              alignItems: "center",
              gap: "6px",
            }}
          >
            {step === "select" && isGroup ? (
              "Next"
            ) : (
              <>
                <Plus size={16} />
                {isGroup ? "Create Group" : "Start Conversation"}
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}

export default GroupDMCreationModal;
