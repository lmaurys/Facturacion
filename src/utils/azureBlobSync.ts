// Configuración de Azure Blob Storage con SAS Token (sin problemas de CORS)
const AZURE_CONFIG = {
  storageAccount: 'cmfiles',
  containerName: 'capacitaciones',
  blobName: 'sistema_gestion_completo.json',
  // URL completa con SAS Token válido hasta 2050
  blobUrlWithSas: 'https://cmfiles.blob.core.windows.net/capacitaciones/sistema_gestion_completo.json?sp=rw&st=2025-06-25T14:02:06Z&se=2050-06-25T22:02:06Z&spr=https&sv=2024-11-04&sr=b&sig=brOzrK6Pj34fFUQdcm7AAY9sm%2Fr0OGHGZoR73G6Yaiw%3D',
  get blobUrl() {
    return `https://${this.storageAccount}.blob.core.windows.net/${this.containerName}/${this.blobName}`;
  }
};

export interface SyncData {
  courses: any[];
  clients: any[];
  invoices: any[];
  exportDate: string;
  version: number;
}



/**
 * Descargar usando SAS Token (con autenticación automática)
 */
const downloadWithSasToken = async (): Promise<SyncData | null> => {
  try {
    console.log('🔑 Descargando usando SAS Token...');
    const response = await fetch(AZURE_CONFIG.blobUrlWithSas, {
      method: 'GET',
      headers: {
        'Cache-Control': 'no-cache'
      }
    });

    if (response.ok) {
      const text = await response.text();
      const data = JSON.parse(text);
      console.log('✅ Descarga con SAS Token exitosa');
      return data;
    } else {
      console.log('❌ Error en descarga con SAS Token, código:', response.status);
      const errorText = await response.text();
      console.log('📋 Error details:', errorText);
      return null;
    }
  } catch (error) {
    console.log('❌ Descarga con SAS Token falló:', error);
    return null;
  }
};

/**
 * Subir usando SAS Token - Múltiples estrategias para evitar CORS
 */
const uploadWithSasToken = async (jsonString: string): Promise<boolean> => {
  const strategies: Array<{name: string, headers: Record<string, string>}> = [
    {
      name: 'Estrategia 1: Headers requeridos por Azure',
      headers: {
        'x-ms-blob-type': 'BlockBlob',
        'Content-Type': 'application/json'
      }
    },
    {
      name: 'Estrategia 2: Solo header obligatorio',
      headers: {
        'x-ms-blob-type': 'BlockBlob'
      }
    }
  ];

  for (const strategy of strategies) {
    try {
      console.log(`🔑 ${strategy.name}...`);
      
      const response = await fetch(AZURE_CONFIG.blobUrlWithSas, {
        method: 'PUT',
        headers: strategy.headers,
        body: jsonString
      });

      console.log('📊 Respuesta:', {
        status: response.status,
        statusText: response.statusText,
        headers: Object.fromEntries(response.headers.entries())
      });

      if (response.ok || response.status === 201) {
        console.log(`✅ ${strategy.name} exitosa!`);
        return true;
      } else {
        const errorText = await response.text();
        console.log(`❌ ${strategy.name} falló:`, errorText);
      }
    } catch (error) {
      console.log(`❌ Error en ${strategy.name}:`, error);
    }
  }
  
  return false;
};

/**
 * Cargar datos desde Azure Blob Storage
 */
export const loadDataFromAzure = async (): Promise<SyncData | null> => {
  try {
    console.log('🔄 Cargando datos desde Azure Blob Storage...');
    
    // Usar SAS Token para descargar
    const sasData = await downloadWithSasToken();
    if (sasData) {
      console.log('✅ Datos cargados exitosamente desde Azure:', {
        courses: sasData.courses?.length || 0,
        clients: sasData.clients?.length || 0,
        invoices: sasData.invoices?.length || 0,
        exportDate: sasData.exportDate
      });
      return sasData;
    }

    console.log('❌ No se pudo cargar datos desde Azure');
    return null;
    
  } catch (error) {
    console.error('❌ Error cargando datos desde Azure:', error);
    return null;
  }
};

/**
 * Guardar datos en Azure Blob Storage
 */
export const saveDataToAzure = async (data: SyncData): Promise<boolean> => {
  try {
    console.log('🔄 Guardando datos en Azure Blob Storage...');
    console.log('📊 Datos a enviar:', {
      courses: data.courses.length,
      clients: data.clients.length,
      invoices: data.invoices.length,
      exportDate: data.exportDate
    });

    // Convertir datos a string JSON
    const jsonString = JSON.stringify(data, null, 2);
    
    console.log('📤 Subiendo archivo a Azure Blob Storage...');
    console.log('📍 URL con SAS Token configurada');
    console.log('📏 Tamaño:', jsonString.length, 'caracteres');
    
    // Usar SAS Token para subir
    const success = await uploadWithSasToken(jsonString);
    
    if (success) {
      console.log('✅ Datos guardados exitosamente en Azure Blob Storage');
      return true;
    } else {
      console.log('❌ Subida con SAS Token falló');
      return false;
    }
    
  } catch (error) {
    console.error('❌ Error guardando datos en Azure:', error);
    return false;
  }
};

/**
 * Verificar si el blob existe en Azure
 */
export const checkBlobExists = async (): Promise<boolean> => {
  try {
    const response = await fetch(AZURE_CONFIG.blobUrlWithSas, {
      method: 'HEAD'
    });
    
    const exists = response.ok;
    console.log('🔍 Verificación de existencia:', exists ? 'El blob existe' : 'El blob no existe');
    return exists;
  } catch (error) {
    console.error('❌ Error verificando existencia del blob:', error);
    return false;
  }
};

/**
 * Sincronizar datos locales con Azure Blob Storage
 */
export const syncWithAzure = async (localData: SyncData): Promise<boolean> => {
  try {
    console.log('🔄 Iniciando sincronización con Azure...');
    
    // Cargar datos remotos
    const remoteData = await loadDataFromAzure();
    
    if (!remoteData) {
      // No hay datos remotos, subir los locales
      console.log('📤 No hay datos remotos, subiendo datos locales...');
      return await saveDataToAzure(localData);
    }

    // Comparar versiones y fechas
    const localDate = new Date(localData.exportDate);
    const remoteDate = new Date(remoteData.exportDate);
    
    console.log('📅 Comparando fechas:', {
      local: localData.exportDate,
      remoto: remoteData.exportDate,
      localMasReciente: localDate > remoteDate
    });
    
    if (localDate > remoteDate || localData.version > remoteData.version) {
      // Los datos locales son más recientes
      console.log('🆙 Datos locales más recientes, subiendo a Azure...');
      return await saveDataToAzure(localData);
    } else if (remoteDate > localDate || remoteData.version > localData.version) {
      // Los datos remotos son más recientes
      console.log('📥 Datos remotos más recientes, sincronización completada');
      return true;
    } else {
      // Datos sincronizados
      console.log('✅ Datos ya sincronizados');
      return true;
    }
  } catch (error) {
    console.error('❌ Error en sincronización con Azure:', error);
    return false;
  }
};

/**
 * Función de debugging para probar la conectividad
 */
export const saveDataToAzureAlternative = async (data: SyncData): Promise<boolean> => {
  console.log('🔍 MODO DEBUG - Información de troubleshooting:');
  console.log('🔗 URL del blob:', AZURE_CONFIG.blobUrl);
  console.log('📦 Container:', AZURE_CONFIG.containerName);
  console.log('📄 Blob name:', AZURE_CONFIG.blobName);
  console.log('📊 Tamaño de datos:', JSON.stringify(data).length, 'caracteres');
  
  try {
    // Verificar si el blob es accesible
    console.log('🧪 Probando acceso de lectura...');
    const existingData = await loadDataFromAzure();
    
    if (existingData) {
      console.log('✅ LECTURA FUNCIONA - Blob es accesible');
      console.log('📋 Datos existentes:', {
        courses: existingData.courses?.length || 0,
        clients: existingData.clients?.length || 0,
        invoices: existingData.invoices?.length || 0,
        exportDate: existingData.exportDate
      });
    } else {
      console.log('❌ Blob no es accesible para lectura');
    }
    
    // Ahora probar ESCRITURA con CORS configurado
    console.log('🧪 Probando ESCRITURA con CORS configurado...');
    const writeSuccess = await saveDataToAzure(data);
    
    if (writeSuccess) {
      console.log('🎉 ¡ESCRITURA EXITOSA! Azure Blob Storage completamente funcional');
      return true;
    } else {
      console.log('❌ Escritura aún falla, revisar configuración CORS');
      return false;
    }
    
  } catch (error) {
    console.error('❌ Error en debugging:', error);
    return false;
  }
}; 