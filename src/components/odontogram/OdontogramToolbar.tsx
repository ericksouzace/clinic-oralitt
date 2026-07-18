import React, { useState } from "react";
import {
  Button,
  Select,
  Label,
  Input,
} from "@/components/ui-bits";
import {
  TOOTH_REGIONS,
  TOOTH_STATUS,
  STATUS_COLORS,
} from "@/lib/store";
import {
  useOdontogramCustomTypes,
} from "./useOdontogramCustomTypes";
import {
  Trash2,
} from "lucide-react";

interface Props {
  brushStatus: string;
  setBrushStatus: (
    status: string
  ) => void;
  brushRegion: string;
  setBrushRegion: (
    region: string
  ) => void;
}

export function OdontogramToolbar({
  brushStatus,
  setBrushStatus,
  brushRegion,
  setBrushRegion,
}: Props) {
  const {
    types: customTypes,
    addType,
    deleteType,
    loading: loadingCustom,
  } = useOdontogramCustomTypes();

  const [
    isAddingCustom,
    setIsAddingCustom,
  ] = useState(false);

  const [
    customName,
    setCustomName,
  ] = useState("");

  const [
    customColor,
    setCustomColor,
  ] = useState("#ff00ff");

  const [
    isSavingCustom,
    setIsSavingCustom,
  ] = useState(false);

  const [
    deletingId,
    setDeletingId,
  ] = useState<string | null>(
    null
  );

  const normalizeStatus = (
    value: string
  ) => {
    return value
      .trim()
      .toLowerCase();
  };

  const getStatusColor = (
    status: string
  ) => {
    const normalizedStatus =
      normalizeStatus(status);

    const defaultStatus =
      Object.entries(
        STATUS_COLORS
      ).find(
        ([key]) =>
          normalizeStatus(key) ===
          normalizedStatus
      );

    if (defaultStatus) {
      return defaultStatus[1];
    }

    const custom =
      customTypes.find(
        (type) =>
          normalizeStatus(
            type.name
          ) ===
          normalizedStatus
      );

    return (
      custom?.color ||
      "#64748b"
    );
  };

  const handleAddCustom =
    async () => {
      const name =
        customName.trim();

      if (
        !name ||
        isSavingCustom
      ) {
        return;
      }

      try {
        setIsSavingCustom(
          true
        );

        const newType =
          await addType(
            name,
            customColor
          );

        if (newType) {
          setBrushStatus(
            newType.name
          );

          setIsAddingCustom(
            false
          );

          setCustomName("");

          setCustomColor(
            "#ff00ff"
          );
        }
      } catch (error) {
        console.error(
          "Não foi possível salvar a situação personalizada:",
          error
        );

        alert(
          "Não foi possível salvar a situação clínica."
        );
      } finally {
        setIsSavingCustom(
          false
        );
      }
    };

  const handleDeleteCustom =
    async (
      id: string,
      name: string
    ) => {
      const confirmed =
        window.confirm(
          `Deseja realmente excluir a situação "${name}"?`
        );

      if (!confirmed) {
        return;
      }

      try {
        setDeletingId(id);

        await deleteType(id);

        if (
          normalizeStatus(
            brushStatus
          ) ===
          normalizeStatus(name)
        ) {
          setBrushStatus(
            TOOTH_STATUS[0]
          );
        }
      } catch (error) {
        console.error(
          "Não foi possível excluir a situação personalizada:",
          error
        );

        alert(
          `Não foi possível excluir a situação "${name}".`
        );
      } finally {
        setDeletingId(
          null
        );
      }
    };

  const handleCancelCustom =
    () => {
      if (
        isSavingCustom
      ) {
        return;
      }

      setIsAddingCustom(
        false
      );

      setCustomName("");

      setCustomColor(
        "#ff00ff"
      );
    };

  return (
    <div className="flex flex-col gap-6 p-4 bg-white border border-border rounded-lg shadow-sm">
      <div className="flex flex-col gap-4">

        {/* SITUAÇÕES CLÍNICAS */}
        <div className="flex-1">

          <Label className="mb-2">
            Selecionar Situação
            Clínica
          </Label>

          <div className="flex flex-wrap gap-2">

            {/* SITUAÇÕES PADRÃO */}
            {TOOTH_STATUS.map(
              (status) => (
                <button
                  key={status}
                  type="button"
                  onClick={() => {
                    setBrushStatus(
                      status
                    );

                    setIsAddingCustom(
                      false
                    );
                  }}
                  className={`
                    flex
                    items-center
                    gap-2
                    px-3
                    py-1.5
                    rounded-full
                    text-xs
                    font-medium
                    border
                    transition-all

                    ${
                      normalizeStatus(
                        brushStatus
                      ) ===
                      normalizeStatus(
                        status
                      )
                        ? "ring-2 ring-offset-1 border-transparent text-white"
                        : "border-border hover:bg-secondary"
                    }
                  `}
                  style={{
                    backgroundColor:
                      normalizeStatus(
                        brushStatus
                      ) ===
                      normalizeStatus(
                        status
                      )
                        ? getStatusColor(
                            status
                          )
                        : "transparent",

                    borderColor:
                      normalizeStatus(
                        brushStatus
                      ) ===
                      normalizeStatus(
                        status
                      )
                        ? getStatusColor(
                            status
                          )
                        : undefined,
                  }}
                >
                  <div
                    className="w-3 h-3 rounded-full shrink-0"
                    style={{
                      backgroundColor:
                        getStatusColor(
                          status
                        ),
                    }}
                  />

                  <span className="capitalize">
                    {status}
                  </span>
                </button>
              )
            )}

            {/* SITUAÇÕES PERSONALIZADAS */}
            {customTypes.map(
              (type) => {
                const isSelected =
                  normalizeStatus(
                    brushStatus
                  ) ===
                  normalizeStatus(
                    type.name
                  );

                return (
                  <div
                    key={type.id}
                    className="
                      group
                      relative
                      inline-flex
                      items-center
                    "
                  >

                    {/* BOTÃO DA SITUAÇÃO */}
                    <button
                      type="button"
                      onClick={() => {
                        setBrushStatus(
                          type.name
                        );

                        setIsAddingCustom(
                          false
                        );
                      }}
                      className={`
                        flex
                        items-center
                        gap-2

                        pl-3
                        pr-8
                        py-1.5

                        rounded-full

                        text-xs
                        font-medium

                        border

                        transition-all

                        ${
                          isSelected
                            ? "ring-2 ring-offset-1 border-transparent text-white"
                            : "border-border hover:bg-secondary"
                        }
                      `}
                      style={{
                        backgroundColor:
                          isSelected
                            ? type.color
                            : "transparent",

                        borderColor:
                          isSelected
                            ? type.color
                            : undefined,
                      }}
                    >
                      <div
                        className="
                          w-3
                          h-3
                          rounded-full
                          shrink-0
                        "
                        style={{
                          backgroundColor:
                            type.color,
                        }}
                      />

                      <span>
                        {type.name}
                      </span>
                    </button>

                    {/* BOTÃO EXCLUIR */}
                    <button
                      type="button"
                      title={`Excluir ${type.name}`}
                      aria-label={`Excluir situação ${type.name}`}
                      disabled={
                        deletingId ===
                        type.id
                      }
                      onClick={(
                        event
                      ) => {
                        event.preventDefault();

                        event.stopPropagation();

                        handleDeleteCustom(
                          type.id,
                          type.name
                        );
                      }}
                      className="
                        absolute

                        right-1
                        top-1/2

                        -translate-y-1/2

                        w-6
                        h-6

                        flex
                        items-center
                        justify-center

                        rounded-full

                        text-muted-foreground

                        bg-transparent

                        hover:text-red-600
                        hover:bg-red-50

                        transition-all

                        opacity-70

                        group-hover:opacity-100

                        disabled:opacity-30
                        disabled:cursor-not-allowed
                      "
                    >
                      {deletingId ===
                      type.id ? (
                        <div
                          className="
                            w-3
                            h-3

                            border-2
                            border-current
                            border-t-transparent

                            rounded-full

                            animate-spin
                          "
                        />
                      ) : (
                        <Trash2
                          className="
                            w-3.5
                            h-3.5
                          "
                        />
                      )}
                    </button>
                  </div>
                );
              }
            )}

            {/* ADICIONAR SITUAÇÃO */}
            <button
              type="button"
              onClick={() =>
                setIsAddingCustom(
                  (
                    current
                  ) =>
                    !current
                )
              }
              className="
                flex
                items-center
                gap-1

                px-3
                py-1.5

                rounded-full

                text-xs
                font-medium

                border
                border-dashed
                border-border

                hover:bg-secondary

                text-muted-foreground

                transition-colors
              "
            >
              + Adicionar situação
            </button>

          </div>
        </div>

        {/* REGIÃO DO DENTE */}
        <div className="w-full">

          <Label className="mb-2">
            Região do Dente
          </Label>

          <Select
            value={
              brushRegion
            }
            onChange={(
              event
            ) =>
              setBrushRegion(
                event.target
                  .value
              )
            }
          >
            {TOOTH_REGIONS.map(
              (region) => (
                <option
                  key={region}
                  value={region}
                  className="capitalize"
                >
                  {region}
                </option>
              )
            )}
          </Select>

        </div>

      </div>

      {/* FORMULÁRIO PARA NOVA SITUAÇÃO */}
      {isAddingCustom && (

        <div
          className="
            flex
            flex-col
            gap-3

            bg-secondary/30

            p-3

            rounded-md

            border
            border-border

            mt-2
          "
        >

          {/* NOME */}
          <div className="w-full">

            <Label>
              Nome da Situação
            </Label>

            <Input
              value={
                customName
              }
              onChange={(
                event
              ) =>
                setCustomName(
                  event.target
                    .value
                )
              }
              placeholder="Ex: IML, Faceta, Fratura..."
              disabled={
                isSavingCustom
              }
            />

          </div>

          {/* COR */}
          <div className="w-full">

            <Label>
              Cor
            </Label>

            <div
              className="
                flex
                items-center
                gap-3

                mt-1
              "
            >

              <input
                type="color"
                value={
                  customColor
                }
                onChange={(
                  event
                ) =>
                  setCustomColor(
                    event.target
                      .value
                  )
                }
                disabled={
                  isSavingCustom
                }
                className="
                  w-10
                  h-10

                  p-0

                  border
                  border-border

                  rounded-md

                  cursor-pointer

                  disabled:cursor-not-allowed
                  disabled:opacity-50
                "
              />

              <Input
                value={
                  customColor
                }
                onChange={(
                  event
                ) =>
                  setCustomColor(
                    event.target
                      .value
                  )
                }
                disabled={
                  isSavingCustom
                }
                className="flex-1"
              />

            </div>

          </div>

          {/* BOTÕES */}
          <div
            className="
              flex
              items-center
              gap-2

              mt-1
            "
          >

            <Button
              variant="gold"
              onClick={
                handleAddCustom
              }
              disabled={
                !customName.trim() ||
                loadingCustom ||
                isSavingCustom
              }
              className="flex-1"
            >
              {isSavingCustom
                ? "Salvando..."
                : "Salvar"}
            </Button>

            <Button
              variant="ghost"
              onClick={
                handleCancelCustom
              }
              disabled={
                isSavingCustom
              }
            >
              Cancelar
            </Button>

          </div>

        </div>

      )}

    </div>
  );
}
