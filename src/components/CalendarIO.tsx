import { useState } from 'react';
import { useBookingStore } from '../store/bookingStore';
import { Download, Upload, Info, FileJson, FileSpreadsheet } from 'lucide-react';

export default function CalendarIO() {
  const { exportCalendar, importCalendar, rooms, selectedRoomIds, currentRole } = useBookingStore();
  const [showImport, setShowImport] = useState(false);
  const [importData, setImportData] = useState('');
  const [importError, setImportError] = useState('');

  const handleExport = () => {
    const data = exportCalendar();
    const blob = new Blob([data], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `calendar_export_${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleImport = () => {
    try {
      const data = JSON.parse(importData);
      importCalendar(data);
      setShowImport(false);
      setImportData('');
      setImportError('');
      alert('导入成功');
    } catch (e) {
      setImportError('JSON格式错误，请检查导入有效的导出文件');
    }
  };

  const handleFileImport = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    
    const reader = new FileReader();
    reader.onload = (event) => {
      const content = event.target?.result as string;
      setImportData(content);
    };
    reader.readAsText(file);
  };

  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4">
      <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
      </h3>
      
      <div className="grid grid-cols-2 gap-4">
        <button
          onClick={handleExport}
          className="p-4 border-2 border-dashed border-gray-300 rounded-lg hover:border-indigo-400 hover:bg-indigo-50 transition-colors flex flex-col items-center gap-2 text-gray-700"
        >
          <Download className="w-8 h-8 text-indigo-600" />
          <span className="font-medium">导出日历数据</span>
          <span className="text-xs text-gray-500">
            导出 {selectedRoomIds.length > 0 ? selectedRoomIds.length : rooms.length} 个房间的数据
          </span>
        </button>
        
        <button
          onClick={() => setShowImport(!showImport)}
          className="p-4 border-2 border-dashed border-gray-300 rounded-lg hover:border-green-400 hover:bg-green-50 transition-colors flex flex-col items-center gap-2 text-gray-700"
        >
          <Upload className="w-8 h-8 text-green-600" />
          <span className="font-medium">导入日历数据</span>
          <span className="text-xs text-gray-500">支持 JSON 格式导入</span>
        </button>
      </div>

      {showImport && (
        <div className="mt-4 p-4 bg-gray-50 rounded-lg">
          <h4 className="font-medium text-gray-900 mb-3">导入数据</h4>
          
          <div className="mb-3">
            <label className="block text-sm font-medium text-gray-700 mb-2">选择文件</label>
            <input
              type="file"
              accept=".json"
              onChange={handleFileImport}
              className="w-full text-sm text-gray-500
                file:mr-4 file:py-2 file:px-4
                file:rounded-lg file:border-0
                file:text-sm file:font-medium
                file:bg-indigo-50 file:text-indigo-700
                hover:file:bg-indigo-100"
            />
          </div>
          
          <div className="mb-3">
            <label className="block text-sm font-medium text-gray-700 mb-2">或粘贴 JSON 数据</label>
            <textarea
              className="w-full h-32 border border-gray-300 rounded-lg p-3 text-sm font-mono"
              value={importData}
              onChange={(e) => setImportData(e.target.value)}
              placeholder="粘贴 JSON 数据..."
            />
          </div>
          
          {importError && (
            <div className="mb-3 p-2 bg-red-50 border border-red-200 rounded text-sm text-red-700">
              {importError}
            </div>
          )}
          
          <div className="flex gap-2">
            <button
              onClick={handleImport}
              disabled={!importData}
              className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:bg-gray-300"
            >
              确认导入
            </button>
            <button
              onClick={() => {
                setShowImport(false);
                setImportData('');
                setImportError('');
              }}
              className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50"
            >
              取消
            </button>
          </div>
        </div>
      )}

      <div className="mt-4 p-3 bg-blue-50 border border-blue-200 rounded-lg">
        <div className="flex items-start gap-2">
          <Info className="w-5 h-5 text-blue-600 flex-shrink-0 mt-0.5" />
          <div className="text-sm text-blue-800">
            <div className="font-medium">数据说明</div>
            <div className="text-blue-600 mt-1">
              导出的数据包含：房间信息、日历状态、节假日价格、维修记录、锁房记录、订单信息。所有数据均保存在浏览器本地，刷新页面不会丢失。
            </div>
          </div>
        </div>
      </div>

      <div className="mt-4 grid grid-cols-2 gap-3">
        <div className="flex items-center gap-2 p-3 bg-gray-50 rounded-lg">
          <FileJson className="w-5 h-5 text-gray-600" />
          <div className="text-sm">
            <div className="font-medium text-gray-900">JSON 格式</div>
            <div className="text-xs text-gray-500">完整数据结构</div>
          </div>
        </div>
        <div className="flex items-center gap-2 p-3 bg-gray-50 rounded-lg">
          <FileSpreadsheet className="w-5 h-5 text-gray-600" />
          <div className="text-sm">
            <div className="font-medium text-gray-900">可转换 Excel</div>
            <div className="text-xs text-gray-500">JSON 可转 Excel</div>
          </div>
        </div>
      </div>
    </div>
  );
}
