export function departmentTriggerLabel(
  departmentId: string | undefined,
  departments: { id: string; name: string }[] | undefined,
  emptyLabel = "Selecionar departamento",
): string {
  if (!departmentId || departmentId === "__none__") return emptyLabel;
  const name = departments?.find((d) => d.id === departmentId)?.name;
  return name ?? emptyLabel;
}
