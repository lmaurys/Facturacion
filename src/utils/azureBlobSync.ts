// Configuración de Azure Blob Storage con SAS Token (sin problemas de CORS)
const AZURE_CONFIG = {
  storageAccount: 'cmfiles',
  containerName: 'capacitaciones',
  blobName: 'sistema_gestion_completo.json',
  // URL pública para lectura
  publicUrl: 'https://cmfiles.blob.core.windows.net/capacitaciones/sistema_gestion_completo.json',
  // SAS Token para escritura
  blobUrlWithSas: 'https://cmfiles.blob.core.windows.net/capacitaciones/sistema_gestion_completo.json?sp=racw&st=2025-07-11T01:17:09Z&se=2028-07-28T09:32:09Z&spr=https&sv=2024-11-04&sr=b&sig=%2BldzbqQsL35N2P4KSgUFIXMowCWL2rjkF50Uw4svfaw%3D'
};

export interface SyncData {
  courses: any[];
  clients: any[];
  invoices: any[];
  blackouts?: any[];
  exportDate: string;
  version: number;
}

/**
 * Cargar datos desde Azure Blob Storage (URL pública)
 */
export const loadDataFromAzure = async (): Promise<SyncData | null> => {
  try {
    console.log('🔄 Cargando datos desde Azure Blob Storage...');
    
    const response = await fetch(AZURE_CONFIG.publicUrl, {
      method: 'GET',
      headers: {
        'Cache-Control': 'no-cache'
      }
    });

    if (response.ok) {
      const text = await response.text();
      const data = JSON.parse(text);
      console.log('✅ Datos cargados exitosamente desde Azure:', {
        courses: data.courses?.length || 0,
        clients: data.clients?.length || 0,
        invoices: data.invoices?.length || 0,
        exportDate: data.exportDate
      });
      return data;
    } else {
      console.log('❌ Error cargando datos desde Azure:', response.status);
      return null;
    }
  } catch (error) {
    console.error('❌ Error cargando datos desde Azure:', error);
    return null;
  }
};

/**
 * Guardar datos en Azure Blob Storage (con SAS Token)
 */
export const saveDataToAzure = async (data: SyncData): Promise<boolean> => {
  try {
    console.log('🔄 Guardando datos en Azure Blob Storage...');
    
    const jsonString = JSON.stringify(data, null, 2);
    
    const response = await fetch(AZURE_CONFIG.blobUrlWithSas, {
      method: 'PUT',
      headers: {
        'x-ms-blob-type': 'BlockBlob',
        'Content-Type': 'application/json'
      },
      body: jsonString
    });

    if (response.ok || response.status === 201) {
      console.log('✅ Datos guardados exitosamente en Azure');
      return true;
    } else {
      const errorText = await response.text();
      console.log('❌ Error guardando en Azure:', response.status, errorText.substring(0, 200));
      return false;
    }
  } catch (error) {
    console.error('❌ Error guardando datos en Azure:', error);
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
 * Diagnosticar el estado de Azure Blob Storage
 */
export const diagnoseBlobStorage = async (): Promise<void> => {
  console.log('🔍 === DIAGNÓSTICO DE AZURE BLOB STORAGE ===');
  console.log('📋 Configuración actual:', {
    storageAccount: AZURE_CONFIG.storageAccount,
    containerName: AZURE_CONFIG.containerName,
    blobName: AZURE_CONFIG.blobName,
    publicUrl: AZURE_CONFIG.publicUrl,
    sasTokenPresent: AZURE_CONFIG.blobUrlWithSas ? 'Sí' : 'No'
  });

  // Test 1: Probar conexión con URL pública
  console.log('\n🔍 Test 1: Probando carga con URL pública...');
  try {
    const response = await fetch(AZURE_CONFIG.publicUrl, {
      method: 'GET',
      headers: {
        'Cache-Control': 'no-cache'
      }
    });

    if (response.ok) {
      const text = await response.text();
      const data = JSON.parse(text);
      console.log('✅ URL pública funciona correctamente');
      console.log('📊 Datos encontrados:', {
        courses: data.courses?.length || 0,
        clients: data.clients?.length || 0,
        invoices: data.invoices?.length || 0,
        exportDate: data.exportDate,
        version: data.version
      });
    } else {
      console.log('❌ Error con URL pública:', response.status, response.statusText);
    }
  } catch (error) {
    console.error('❌ Error probando URL pública:', error);
  }

  // Test 2: Probar escritura con SAS Token
  console.log('\n🔍 Test 2: Probando escritura con SAS Token...');
  try {
    const testData = {
      test: true,
      timestamp: new Date().toISOString(),
      message: 'Test de diagnóstico'
    };
    
    const testResponse = await fetch(AZURE_CONFIG.blobUrlWithSas, {
      method: 'PUT',
      headers: {
        'x-ms-blob-type': 'BlockBlob',
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(testData)
    });

    if (testResponse.ok || testResponse.status === 201) {
      console.log('✅ SAS Token funciona correctamente para escritura');
    } else {
      const errorText = await testResponse.text();
      console.log('❌ Error con SAS Token:', testResponse.status, testResponse.statusText);
      console.log('❌ Detalle del error:', errorText.substring(0, 200));
    }
  } catch (error) {
    console.error('❌ Error probando SAS Token:', error);
  }

  // Test 3: Probar sincronización completa
  console.log('\n🔍 Test 3: Probando carga de datos...');
  try {
    const data = await loadDataFromAzure();
    if (data) {
      console.log('✅ Función loadDataFromAzure funciona correctamente');
      console.log('📊 Datos cargados:', {
        courses: data.courses?.length || 0,
        clients: data.clients?.length || 0,
        invoices: data.invoices?.length || 0
      });
    } else {
      console.log('❌ loadDataFromAzure retornó null');
    }
  } catch (error) {
    console.error('❌ Error en loadDataFromAzure:', error);
  }

  console.log('\n🔍 === FIN DEL DIAGNÓSTICO ===');
};

/**
 * Diagnosticar específicamente el SAS Token de Azure Blob Storage
 */
export const diagnoseSasToken = async (): Promise<void> => {
  console.log('🔍 === DIAGNÓSTICO DEL SAS TOKEN ===');
  
  // Verificar si el SAS Token está presente
  if (!AZURE_CONFIG.blobUrlWithSas) {
    console.log('❌ No hay SAS Token configurado');
    return;
  }

  // Extraer y analizar el SAS Token
  const sasTokenMatch = AZURE_CONFIG.blobUrlWithSas.match(/\?(.+)$/);
  if (sasTokenMatch) {
    const sasParams = new URLSearchParams(sasTokenMatch[1]);
    console.log('📋 Parámetros del SAS Token:');
    sasParams.forEach((value, key) => {
      if (key === 'se') {
        const expiry = new Date(value);
        const now = new Date();
        const isExpired = expiry < now;
        console.log(`  ${key}: ${value} (${isExpired ? '❌ EXPIRADO' : '✅ VÁLIDO'})`);
      } else if (key === 'st') {
        const start = new Date(value);
        const now = new Date();
        const isActive = start <= now;
        console.log(`  ${key}: ${value} (${isActive ? '✅ ACTIVO' : '❌ AÚN NO ACTIVO'})`);
      } else {
        console.log(`  ${key}: ${value}`);
      }
    });
  }

  // Test de escritura con SAS Token
  console.log('\n🔍 Probando escritura con SAS Token...');
  try {
    const testData = {
      test: true,
      timestamp: new Date().toISOString(),
      message: 'Test específico de SAS Token'
    };
    
    const response = await fetch(AZURE_CONFIG.blobUrlWithSas, {
      method: 'PUT',
      headers: {
        'x-ms-blob-type': 'BlockBlob',
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(testData)
    });

    console.log('📊 Respuesta del servidor:', {
      status: response.status,
      statusText: response.statusText,
      headers: Object.fromEntries(response.headers.entries())
    });

    if (response.ok || response.status === 201) {
      console.log('✅ SAS Token funciona correctamente');
    } else {
      const errorText = await response.text();
      console.log('❌ Error con SAS Token:', errorText);
      
      // Análisis específico de errores comunes
      if (response.status === 403) {
        console.log('💡 Sugerencia: El SAS Token puede haber expirado o no tener permisos suficientes');
      } else if (response.status === 404) {
        console.log('💡 Sugerencia: Verifica que el container y blob existan');
      } else if (response.status === 400) {
        console.log('💡 Sugerencia: Verifica el formato del SAS Token');
      }
    }
  } catch (error) {
    console.error('❌ Error de red o configuración:', error);
  }

  console.log('\n🔍 === FIN DEL DIAGNÓSTICO DEL SAS TOKEN ===');
}; 