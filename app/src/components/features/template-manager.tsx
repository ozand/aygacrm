"use client";

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Plus,
  Pencil,
  Trash2,
  Layout,
  Loader2,
  Copy,
  GripVertical,
  FileText,
  ChevronRight,
} from "lucide-react";
import {
  getTemplates,
  getTemplate,
  createTemplate,
  updateTemplate,
  deleteTemplate,
  duplicateTemplate,
  createTemplatePage,
  updateTemplatePage,
  deleteTemplatePage,
  createModule,
  deleteModule,
  reorderModules,
  seedDefaultTemplate,
  MODULE_TYPES,
} from "@/lib/actions/templates";

interface Module {
  id: string;
  type: string;
  position: number;
  canBeDeleted: boolean;
}

interface TemplatePage {
  id: string;
  name: string;
  slug: string;
  position: number;
  canBeDeleted: boolean;
  modules: Module[];
}

interface Template {
  id: string;
  name: string;
  canBeDeleted: boolean;
  _count: { pages?: number; contacts: number; vaults: number };
  pages?: TemplatePage[];
}

export function TemplateManager() {
  const [templates, setTemplates] = useState<Template[]>([]);
  const [selectedTemplate, setSelectedTemplate] = useState<Template | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadingDetails, setLoadingDetails] = useState(false);
  
  // Dialog states
  const [isAddTemplateOpen, setIsAddTemplateOpen] = useState(false);
  const [isAddPageOpen, setIsAddPageOpen] = useState(false);
  const [isAddModuleOpen, setIsAddModuleOpen] = useState(false);
  const [editingTemplate, setEditingTemplate] = useState<Template | null>(null);
  const [editingPage, setEditingPage] = useState<TemplatePage | null>(null);
  const [selectedPageId, setSelectedPageId] = useState<string | null>(null);
  
  // Form states
  const [templateName, setTemplateName] = useState("");
  const [pageName, setPageName] = useState("");
  const [pageSlug, setPageSlug] = useState("");
  const [selectedModuleType, setSelectedModuleType] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    loadTemplates();
  }, []);

  async function loadTemplates() {
    try {
      const data = await getTemplates();
      setTemplates(data);
    } catch (error) {
      console.error("Error loading templates:", error);
    } finally {
      setLoading(false);
    }
  }

  async function loadTemplateDetails(id: string) {
    setLoadingDetails(true);
    try {
      const data = await getTemplate(id);
      setSelectedTemplate(data);
    } catch (error) {
      console.error("Error loading template:", error);
    } finally {
      setLoadingDetails(false);
    }
  }

  async function handleSeedDefault() {
    setSaving(true);
    try {
      await seedDefaultTemplate();
      await loadTemplates();
    } catch (error) {
      console.error("Error seeding default:", error);
    } finally {
      setSaving(false);
    }
  }

  async function handleCreateTemplate() {
    if (!templateName.trim()) return;
    setSaving(true);
    try {
      await createTemplate({ name: templateName.trim() });
      await loadTemplates();
      setTemplateName("");
      setIsAddTemplateOpen(false);
    } catch (error) {
      console.error("Error creating template:", error);
    } finally {
      setSaving(false);
    }
  }

  async function handleUpdateTemplate() {
    if (!editingTemplate || !templateName.trim()) return;
    setSaving(true);
    try {
      await updateTemplate(editingTemplate.id, { name: templateName.trim() });
      await loadTemplates();
      if (selectedTemplate?.id === editingTemplate.id) {
        await loadTemplateDetails(editingTemplate.id);
      }
      setEditingTemplate(null);
      setTemplateName("");
    } catch (error) {
      console.error("Error updating template:", error);
    } finally {
      setSaving(false);
    }
  }

  async function handleDeleteTemplate(id: string) {
    const template = templates.find((t) => t.id === id);
    if (!template?.canBeDeleted) {
      alert("This template cannot be deleted");
      return;
    }
    if (!confirm("Are you sure you want to delete this template?")) return;
    
    try {
      await deleteTemplate(id);
      if (selectedTemplate?.id === id) {
        setSelectedTemplate(null);
      }
      await loadTemplates();
    } catch (error) {
      console.error("Error deleting template:", error);
    }
  }

  async function handleDuplicateTemplate(id: string) {
    const template = templates.find((t) => t.id === id);
    if (!template) return;
    
    const newName = prompt("Enter name for the copy:", `${template.name} (Copy)`);
    if (!newName) return;
    
    setSaving(true);
    try {
      await duplicateTemplate(id, newName);
      await loadTemplates();
    } catch (error) {
      console.error("Error duplicating template:", error);
    } finally {
      setSaving(false);
    }
  }

  async function handleCreatePage() {
    if (!selectedTemplate || !pageName.trim() || !pageSlug.trim()) return;
    setSaving(true);
    try {
      await createTemplatePage(selectedTemplate.id, {
        name: pageName.trim(),
        slug: pageSlug.trim(),
      });
      await loadTemplateDetails(selectedTemplate.id);
      setPageName("");
      setPageSlug("");
      setIsAddPageOpen(false);
    } catch (error) {
      console.error("Error creating page:", error);
    } finally {
      setSaving(false);
    }
  }

  async function handleUpdatePage() {
    if (!editingPage || !pageName.trim()) return;
    setSaving(true);
    try {
      await updateTemplatePage(editingPage.id, {
        name: pageName.trim(),
        slug: pageSlug.trim(),
      });
      if (selectedTemplate) {
        await loadTemplateDetails(selectedTemplate.id);
      }
      setEditingPage(null);
      setPageName("");
      setPageSlug("");
    } catch (error) {
      console.error("Error updating page:", error);
    } finally {
      setSaving(false);
    }
  }

  async function handleDeletePage(id: string) {
    const page = selectedTemplate?.pages?.find((p) => p.id === id);
    if (!page?.canBeDeleted) {
      alert("This page cannot be deleted");
      return;
    }
    if (!confirm("Are you sure? All modules on this page will be deleted.")) return;
    
    try {
      await deleteTemplatePage(id);
      if (selectedTemplate) {
        await loadTemplateDetails(selectedTemplate.id);
      }
    } catch (error) {
      console.error("Error deleting page:", error);
    }
  }

  async function handleAddModule() {
    if (!selectedPageId || !selectedModuleType) return;
    setSaving(true);
    try {
      await createModule(selectedPageId, { type: selectedModuleType });
      if (selectedTemplate) {
        await loadTemplateDetails(selectedTemplate.id);
      }
      setSelectedModuleType("");
      setIsAddModuleOpen(false);
    } catch (error) {
      console.error("Error adding module:", error);
    } finally {
      setSaving(false);
    }
  }

  async function handleDeleteModule(id: string, canBeDeleted: boolean) {
    if (!canBeDeleted) {
      alert("This module cannot be deleted");
      return;
    }
    if (!confirm("Remove this module from the page?")) return;
    
    try {
      await deleteModule(id);
      if (selectedTemplate) {
        await loadTemplateDetails(selectedTemplate.id);
      }
    } catch (error) {
      console.error("Error deleting module:", error);
    }
  }

  function getModuleLabel(type: string) {
    return MODULE_TYPES.find((m) => m.type === type)?.label || type;
  }

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Layout className="h-5 w-5" />
            Contact Page Templates
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="md:col-span-2">
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <Layout className="h-5 w-5" />
              Contact Page Templates
            </CardTitle>
            <CardDescription>
              Customize which modules appear on contact pages and their order
            </CardDescription>
          </div>
          <div className="flex gap-2">
            {templates.length === 0 && (
              <Button
                variant="outline"
                size="sm"
                onClick={handleSeedDefault}
                disabled={saving}
              >
                {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Create Default
              </Button>
            )}
            <Dialog open={isAddTemplateOpen} onOpenChange={setIsAddTemplateOpen}>
              <DialogTrigger asChild>
                <Button size="sm">
                  <Plus className="mr-2 h-4 w-4" />
                  New Template
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Create Template</DialogTitle>
                  <DialogDescription>
                    Create a new contact page template
                  </DialogDescription>
                </DialogHeader>
                <div className="py-4">
                  <Label htmlFor="template-name">Template Name</Label>
                  <Input
                    id="template-name"
                    placeholder="e.g., Minimal, Detailed, Business"
                    value={templateName}
                    onChange={(e) => setTemplateName(e.target.value)}
                  />
                </div>
                <DialogFooter>
                  <Button variant="outline" onClick={() => setIsAddTemplateOpen(false)}>
                    Cancel
                  </Button>
                  <Button onClick={handleCreateTemplate} disabled={saving || !templateName.trim()}>
                    {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                    Create
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <div className="grid gap-6 lg:grid-cols-3">
          {/* Template List */}
          <div className="space-y-2">
            <h3 className="text-sm font-medium text-muted-foreground mb-3">Templates</h3>
            {templates.length === 0 ? (
              <p className="text-sm text-muted-foreground italic py-4">
                No templates yet. Create one to get started.
              </p>
            ) : (
              templates.map((template) => (
                <div
                  key={template.id}
                  className={`flex items-center justify-between p-3 rounded-lg border cursor-pointer transition-colors ${
                    selectedTemplate?.id === template.id
                      ? "bg-primary/10 border-primary"
                      : "hover:bg-accent/50"
                  }`}
                  onClick={() => loadTemplateDetails(template.id)}
                >
                  <div className="flex items-center gap-2">
                    <FileText className="h-4 w-4 text-muted-foreground" />
                    <div>
                      <div className="font-medium text-sm">{template.name}</div>
                      <div className="text-xs text-muted-foreground">
                        {template._count.pages} pages
                        {template._count.contacts > 0 && ` · ${template._count.contacts} contacts`}
                      </div>
                    </div>
                  </div>
                  <div className="flex gap-1">
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleDuplicateTemplate(template.id);
                      }}
                    >
                      <Copy className="h-3 w-3" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7"
                      onClick={(e) => {
                        e.stopPropagation();
                        setEditingTemplate(template);
                        setTemplateName(template.name);
                      }}
                    >
                      <Pencil className="h-3 w-3" />
                    </Button>
                    {template.canBeDeleted && (
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleDeleteTemplate(template.id);
                        }}
                      >
                        <Trash2 className="h-3 w-3 text-destructive" />
                      </Button>
                    )}
                  </div>
                </div>
              ))
            )}
          </div>

          {/* Template Details */}
          <div className="lg:col-span-2">
            {loadingDetails ? (
              <div className="flex items-center justify-center py-12">
                <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
              </div>
            ) : selectedTemplate?.pages ? (
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <h3 className="text-sm font-medium">
                    Pages in &quot;{selectedTemplate.name}&quot;
                  </h3>
                  <Dialog open={isAddPageOpen} onOpenChange={setIsAddPageOpen}>
                    <DialogTrigger asChild>
                      <Button size="sm" variant="outline">
                        <Plus className="mr-2 h-4 w-4" />
                        Add Page
                      </Button>
                    </DialogTrigger>
                    <DialogContent>
                      <DialogHeader>
                        <DialogTitle>Add Page</DialogTitle>
                      </DialogHeader>
                      <div className="space-y-4 py-4">
                        <div className="space-y-2">
                          <Label htmlFor="page-name">Page Name</Label>
                          <Input
                            id="page-name"
                            placeholder="e.g., Overview, Activities"
                            value={pageName}
                            onChange={(e) => {
                              setPageName(e.target.value);
                              setPageSlug(e.target.value.toLowerCase().replace(/[^a-z0-9]+/g, "-"));
                            }}
                          />
                        </div>
                        <div className="space-y-2">
                          <Label htmlFor="page-slug">URL Slug</Label>
                          <Input
                            id="page-slug"
                            placeholder="e.g., overview, activities"
                            value={pageSlug}
                            onChange={(e) => setPageSlug(e.target.value)}
                          />
                        </div>
                      </div>
                      <DialogFooter>
                        <Button variant="outline" onClick={() => setIsAddPageOpen(false)}>
                          Cancel
                        </Button>
                        <Button
                          onClick={handleCreatePage}
                          disabled={saving || !pageName.trim() || !pageSlug.trim()}
                        >
                          {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                          Add Page
                        </Button>
                      </DialogFooter>
                    </DialogContent>
                  </Dialog>
                </div>

                <Accordion type="multiple" className="space-y-2">
                  {selectedTemplate.pages.map((page) => (
                    <AccordionItem
                      key={page.id}
                      value={page.id}
                      className="border rounded-lg px-4"
                    >
                      <AccordionTrigger className="hover:no-underline">
                        <div className="flex items-center gap-2">
                          <GripVertical className="h-4 w-4 text-muted-foreground" />
                          <span>{page.name}</span>
                          <span className="text-xs text-muted-foreground">
                            /{page.slug}
                          </span>
                        </div>
                      </AccordionTrigger>
                      <AccordionContent>
                        <div className="space-y-3 pt-2">
                          {/* Page actions */}
                          <div className="flex gap-2 justify-end">
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => {
                                setEditingPage(page);
                                setPageName(page.name);
                                setPageSlug(page.slug);
                              }}
                            >
                              <Pencil className="mr-2 h-3 w-3" />
                              Edit
                            </Button>
                            {page.canBeDeleted && (
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => handleDeletePage(page.id)}
                              >
                                <Trash2 className="mr-2 h-3 w-3" />
                                Delete
                              </Button>
                            )}
                            <Button
                              size="sm"
                              variant="default"
                              onClick={() => {
                                setSelectedPageId(page.id);
                                setIsAddModuleOpen(true);
                              }}
                            >
                              <Plus className="mr-2 h-3 w-3" />
                              Add Module
                            </Button>
                          </div>

                          {/* Modules */}
                          {page.modules.length === 0 ? (
                            <p className="text-sm text-muted-foreground italic py-2">
                              No modules on this page yet.
                            </p>
                          ) : (
                            <div className="space-y-1">
                              {page.modules.map((module) => (
                                <div
                                  key={module.id}
                                  className="flex items-center justify-between p-2 rounded bg-muted/50"
                                >
                                  <div className="flex items-center gap-2">
                                    <GripVertical className="h-4 w-4 text-muted-foreground cursor-move" />
                                    <span className="text-sm">
                                      {getModuleLabel(module.type)}
                                    </span>
                                  </div>
                                  {module.canBeDeleted && (
                                    <Button
                                      variant="ghost"
                                      size="icon"
                                      className="h-6 w-6"
                                      onClick={() =>
                                        handleDeleteModule(module.id, module.canBeDeleted)
                                      }
                                    >
                                      <Trash2 className="h-3 w-3 text-destructive" />
                                    </Button>
                                  )}
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                      </AccordionContent>
                    </AccordionItem>
                  ))}
                </Accordion>
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
                <Layout className="h-12 w-12 mb-3 opacity-50" />
                <p>Select a template to edit its pages and modules</p>
              </div>
            )}
          </div>
        </div>

        {/* Edit Template Dialog */}
        <Dialog
          open={!!editingTemplate}
          onOpenChange={(open) => {
            if (!open) {
              setEditingTemplate(null);
              setTemplateName("");
            }
          }}
        >
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Edit Template</DialogTitle>
            </DialogHeader>
            <div className="py-4">
              <Label htmlFor="edit-template-name">Template Name</Label>
              <Input
                id="edit-template-name"
                value={templateName}
                onChange={(e) => setTemplateName(e.target.value)}
              />
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setEditingTemplate(null)}>
                Cancel
              </Button>
              <Button onClick={handleUpdateTemplate} disabled={saving || !templateName.trim()}>
                {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Save
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Edit Page Dialog */}
        <Dialog
          open={!!editingPage}
          onOpenChange={(open) => {
            if (!open) {
              setEditingPage(null);
              setPageName("");
              setPageSlug("");
            }
          }}
        >
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Edit Page</DialogTitle>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label htmlFor="edit-page-name">Page Name</Label>
                <Input
                  id="edit-page-name"
                  value={pageName}
                  onChange={(e) => setPageName(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="edit-page-slug">URL Slug</Label>
                <Input
                  id="edit-page-slug"
                  value={pageSlug}
                  onChange={(e) => setPageSlug(e.target.value)}
                />
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setEditingPage(null)}>
                Cancel
              </Button>
              <Button onClick={handleUpdatePage} disabled={saving || !pageName.trim()}>
                {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Save
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Add Module Dialog */}
        <Dialog open={isAddModuleOpen} onOpenChange={setIsAddModuleOpen}>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle>Add Module</DialogTitle>
              <DialogDescription>
                Choose a module to add to this page
              </DialogDescription>
            </DialogHeader>
            <div className="py-4">
              <Select value={selectedModuleType} onValueChange={setSelectedModuleType}>
                <SelectTrigger>
                  <SelectValue placeholder="Select module type" />
                </SelectTrigger>
                <SelectContent>
                  {MODULE_TYPES.map((m) => (
                    <SelectItem key={m.type} value={m.type}>
                      <div>
                        <div>{m.label}</div>
                        <div className="text-xs text-muted-foreground">{m.description}</div>
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setIsAddModuleOpen(false)}>
                Cancel
              </Button>
              <Button onClick={handleAddModule} disabled={saving || !selectedModuleType}>
                {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Add Module
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </CardContent>
    </Card>
  );
}
